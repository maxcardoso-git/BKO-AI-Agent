import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbDocumentVersion } from '../../memoria/entities/kb-document-version.entity';
import { createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';
import { ConfigService } from '@nestjs/config';
import * as pgvector from 'pgvector/pg';

export interface VectorSearchResult {
  id: string;
  content: string;
  chunkIndex: number;
  sectionTitle: string | null;
  metadata: Record<string, unknown> | null;
  similarity: number;
  documentVersionId: string;
}

@Injectable()
export class VectorSearchService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KbDocumentVersion)
    private readonly versionRepo: Repository<KbDocumentVersion>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolves the OpenAI API key + model for the 'embeddings' functionality,
   * preferring the value stored in resource.apiKeyValue / bearerToken (DB) and
   * falling back to the apiKeyEnvVar through ConfigService. Returns null when
   * no key is configured anywhere.
   *
   * Queries the DB directly to avoid a circular dep with IaModule.
   */
  private async resolveEmbeddingConfig(): Promise<{ apiKey: string | undefined; modelId: string }> {
    const rows = await this.dataSource.query(
      `SELECT lmc."modelId" AS model_id,
              lmc."apiKeyEnvVar" AS env_var,
              r."apiKeyValue" AS api_key_value,
              r."bearerToken" AS bearer_token
         FROM llm_model_config lmc
         LEFT JOIN resource r ON r.id = lmc."resourceId"
        WHERE lmc."functionalityType" = 'embeddings'
          AND lmc."isActive" = true
        LIMIT 1`,
    );
    const row = rows?.[0];
    if (!row) {
      // Fall back to legacy default if no config row exists
      const fallbackKey = this.configService.get<string>('OPENAI_API_KEY');
      return { apiKey: fallbackKey, modelId: 'text-embedding-3-small' };
    }
    const apiKey =
      (row.api_key_value && String(row.api_key_value).trim()) ||
      (row.bearer_token && String(row.bearer_token).trim()) ||
      (row.env_var ? this.configService.get<string>(String(row.env_var)) : undefined);
    return { apiKey, modelId: String(row.model_id) };
  }

  /**
   * Generates an embedding for an arbitrary text using the model configured
   * for 'embeddings' (default text-embedding-3-small). API key is resolved
   * via resolveEmbeddingConfig() — DB first, env fallback.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const { apiKey, modelId } = await this.resolveEmbeddingConfig();
    const openaiProvider = createOpenAI({ apiKey });
    const model = openaiProvider.textEmbeddingModel(modelId);
    const { embedding } = await embed({ model, value: text });
    return embedding;
  }

  /**
   * Searches kb_chunk for the most similar chunks to the query text.
   * Uses pgvector cosine distance (<=> operator, ORDER BY ASC = most similar first).
   * Optionally filters by document source type (e.g., 'manual_anatel', 'guia_iqi').
   */
  async search(
    queryText: string,
    topK = 5,
    sourceType?: string,
  ): Promise<VectorSearchResult[]> {
    // 1. Generate embedding for query text — resolved via DB (resource.apiKeyValue
    //    → bearerToken → env fallback)
    const { apiKey, modelId } = await this.resolveEmbeddingConfig();
    const openaiProvider = createOpenAI({ apiKey });
    const embeddingModel = openaiProvider.textEmbeddingModel(modelId);

    const { embedding } = await embed({
      model: embeddingModel,
      value: queryText,
    });

    // 2. Find active document version IDs (optionally filtered by sourceType)
    let versionQuery = this.versionRepo
      .createQueryBuilder('v')
      .innerJoin('v.document', 'd')
      .where('v."isActive" = true')
      .andWhere('d."isActive" = true');

    if (sourceType) {
      versionQuery = versionQuery.andWhere('d."sourceType" = :sourceType', { sourceType });
    }

    const activeVersions = await versionQuery.getMany();
    const activeVersionIds = activeVersions.map((v) => v.id);

    if (activeVersionIds.length === 0) {
      return [];
    }

    // 3. Run cosine similarity query
    // IMPORTANT: <=> returns cosine DISTANCE. ORDER BY ASC = most similar first.
    // Similarity = 1 - distance
    const vectorParam = pgvector.toSql(embedding);

    const results = await this.dataSource.query(
      `SELECT "id", "content", "chunkIndex", "sectionTitle", "metadata",
              "documentVersionId",
              1 - (embedding <=> $1::vector) AS similarity
       FROM "kb_chunk"
       WHERE "documentVersionId" = ANY($2::uuid[])
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorParam, activeVersionIds, topK],
    );

    return results as VectorSearchResult[];
  }

  /**
   * Searches using a pre-computed embedding vector (no text-to-embedding conversion needed).
   */
  async searchByVector(
    queryEmbedding: number[],
    topK = 5,
    documentVersionIds?: string[],
  ): Promise<VectorSearchResult[]> {
    const vectorParam = pgvector.toSql(queryEmbedding);

    let sql = `
      SELECT "id", "content", "chunkIndex", "sectionTitle", "metadata",
             "documentVersionId",
             1 - (embedding <=> $1::vector) AS similarity
      FROM "kb_chunk"
    `;
    const params: unknown[] = [vectorParam];

    if (documentVersionIds && documentVersionIds.length > 0) {
      sql += ` WHERE "documentVersionId" = ANY($2::uuid[])`;
      params.push(documentVersionIds);
    }

    sql += ` ORDER BY embedding <=> $1::vector ASC LIMIT ${topK}`;

    return this.dataSource.query(sql, params) as Promise<VectorSearchResult[]>;
  }
}
