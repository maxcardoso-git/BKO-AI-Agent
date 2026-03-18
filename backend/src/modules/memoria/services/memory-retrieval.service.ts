import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as pgvector from 'pgvector/pg';

export interface SimilarCaseResult {
  id: string;
  complaintId: string;
  tipologyId: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface SimilarCorrectionResult {
  id: string;
  aiText: string;
  humanText: string;
  diffDescription: string;
  correctionCategory: string;
  similarity: number;
}

export interface StylePatternResult {
  id: string;
  tipologyId: string;
  expressionType: 'approved' | 'forbidden';
  expressionText: string;
  createdAt: Date;
}

@Injectable()
export class MemoryRetrievalService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Finds similar past cases from case_memory using pgvector cosine similarity.
   * ORDER BY cosine distance ASC (lower = more similar).
   */
  async findSimilarCases(
    embedding: number[],
    tipologyId: string,
    limit = 3,
  ): Promise<SimilarCaseResult[]> {
    const vectorParam = pgvector.toSql(embedding);
    const results = await this.dataSource.query(
      `SELECT id, "complaintId", "tipologyId", metadata,
              1 - (embedding <=> $1::vector) AS similarity
       FROM "case_memory"
       WHERE "tipologyId" = $2
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorParam, tipologyId, limit],
    );
    return results as SimilarCaseResult[];
  }

  /**
   * Finds similar human corrections from human_feedback_memory using pgvector cosine similarity.
   * ORDER BY cosine distance ASC (lower = more similar).
   */
  async findSimilarCorrections(
    embedding: number[],
    tipologyId: string,
    limit = 3,
  ): Promise<SimilarCorrectionResult[]> {
    const vectorParam = pgvector.toSql(embedding);
    const results = await this.dataSource.query(
      `SELECT id, "aiText", "humanText", "diffDescription", "correctionCategory",
              1 - (embedding <=> $1::vector) AS similarity
       FROM "human_feedback_memory"
       WHERE "tipologyId" = $2
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorParam, tipologyId, limit],
    );
    return results as SimilarCorrectionResult[];
  }

  /**
   * Retrieves approved and forbidden expression patterns for a tipology from style_memory.
   * Returns the most recently created patterns up to the limit.
   */
  async findStylePatterns(
    tipologyId: string,
    limit = 5,
  ): Promise<StylePatternResult[]> {
    const results = await this.dataSource.query(
      `SELECT id, "tipologyId", "expressionType", "expressionText", "createdAt"
       FROM "style_memory"
       WHERE "tipologyId" = $1
         AND "isActive" = true
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [tipologyId, limit],
    );
    return results as StylePatternResult[];
  }
}
