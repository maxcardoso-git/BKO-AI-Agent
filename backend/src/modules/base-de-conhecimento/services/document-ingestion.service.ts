import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { KbDocument } from '../../memoria/entities/kb-document.entity';
import { KbDocumentVersion } from '../../memoria/entities/kb-document-version.entity';
import { KbChunk } from '../../memoria/entities/kb-chunk.entity';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ConfigService } from '@nestjs/config';
import * as pgvector from 'pgvector/pg';

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);

  constructor(
    @InjectRepository(KbDocument)
    private readonly documentRepo: Repository<KbDocument>,
    @InjectRepository(KbDocumentVersion)
    private readonly versionRepo: Repository<KbDocumentVersion>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Ingests a document from a PDF buffer or plain text.
   * Creates KbDocument + KbDocumentVersion, extracts text, chunks, embeds, and persists kb_chunk rows.
   * Returns the number of chunks created.
   */
  async ingest(
    buffer: Buffer,
    originalName: string,
    sourceType: string,
    mimeType: string,
    changeDescription?: string,
  ): Promise<{ documentId: string; versionId: string; chunkCount: number }> {
    // 1. Extract text based on mime type
    let text: string;
    if (mimeType === 'application/pdf') {
      // pdf-parse is CJS — use dynamic import
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else {
      text = buffer.toString('utf-8');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Document has no extractable text content');
    }

    this.logger.log(`Extracted ${text.length} chars from ${originalName}`);

    // 2. Find or create KbDocument
    let document = await this.documentRepo.findOne({
      where: { title: originalName, sourceType },
    });

    if (!document) {
      document = await this.documentRepo.save(
        this.documentRepo.create({
          title: originalName,
          sourceType,
          mimeType,
          isActive: true,
        }),
      );
    }

    // 3. Determine version number
    const latestVersion = await this.versionRepo
      .createQueryBuilder('v')
      .where('v."documentId" = :docId', { docId: document.id })
      .orderBy('v.version', 'DESC')
      .getOne();

    const newVersionNumber = (latestVersion?.version ?? 0) + 1;

    // 4. Create KbDocumentVersion
    const version = await this.versionRepo.save(
      this.versionRepo.create({
        documentId: document.id,
        version: newVersionNumber,
        changeDescription: changeDescription ?? `Version ${newVersionNumber}`,
        isActive: true,
        chunkCount: 0,
      }),
    );

    // 5. Deactivate previous versions
    if (latestVersion) {
      await this.versionRepo
        .createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where('"documentId" = :docId AND "id" != :versionId', {
          docId: document.id,
          versionId: version.id,
        })
        .execute();
    }

    // 6. Chunk the text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
    const docs = await splitter.createDocuments([text]);

    this.logger.log(`Split into ${docs.length} chunks`);

    if (docs.length === 0) {
      version.chunkCount = 0;
      version.processedAt = new Date();
      await this.versionRepo.save(version);
      return { documentId: document.id, versionId: version.id, chunkCount: 0 };
    }

    // 7. Generate embeddings in batches
    const openaiProvider = createOpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    const embeddingModel = openaiProvider.textEmbeddingModel('text-embedding-3-small');

    const chunkTexts = docs.map((d) => d.pageContent);

    // Batch in groups of 100 to avoid rate limits
    const batchSize = 100;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunkTexts.length; i += batchSize) {
      const batch = chunkTexts.slice(i, i + batchSize);
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: batch,
      });
      allEmbeddings.push(...embeddings);
    }

    // 8. Persist chunks using raw SQL (pgvector.toSql for embedding serialization)
    for (let i = 0; i < docs.length; i++) {
      await this.dataSource.query(
        `INSERT INTO "kb_chunk" ("id", "content", "chunkIndex", "sectionTitle", "metadata", "embedding", "documentVersionId", "createdAt")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5::vector, $6, now())`,
        [
          docs[i].pageContent,
          i,
          null, // sectionTitle — could be extracted from content heuristics
          JSON.stringify({ sourceType, charCount: docs[i].pageContent.length }),
          pgvector.toSql(allEmbeddings[i]),
          version.id,
        ],
      );
    }

    // 9. Update version with chunk count and processedAt
    version.chunkCount = docs.length;
    version.processedAt = new Date();
    await this.versionRepo.save(version);

    this.logger.log(`Ingested ${docs.length} chunks for ${originalName} v${newVersionNumber}`);

    return {
      documentId: document.id,
      versionId: version.id,
      chunkCount: docs.length,
    };
  }
}
