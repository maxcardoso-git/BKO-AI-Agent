import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { embed } from 'ai';
import * as pgvector from 'pgvector/pg';
import { ModelSelectorService } from '../../ia/services/model-selector.service';

@Injectable()
export class MemoryFeedbackService {
  private readonly logger = new Logger(MemoryFeedbackService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly modelSelector: ModelSelectorService,
  ) {}

  /**
   * Persists a human correction or rejection as a HumanFeedbackMemory row with pgvector embedding.
   *
   * IMPORTANT — embedding target: the COMPLAINT text (normalizedText ?? rawText), NOT the AI draft.
   * Retrieval at DraftFinalResponse runs BEFORE any draft exists and searches with the new
   * complaint's embedding, so the stored vector must live in the same "complaint text" space
   * for cosine similarity to be meaningful. (Earlier phases embedded humanText, then aiText —
   * both mismatched what retrieval actually queries with. Existing rows are migrated by
   * src/database/seeds/reembed-feedback-memory.ts.)
   *
   * Non-critical: errors are logged but not re-thrown to avoid breaking the review flow.
   */
  async persistFeedback(params: {
    aiText: string;
    humanText: string;
    diffDescription: string;
    complaintId: string;
    tipologyId: string | null;
    feedbackType: 'correction' | 'rejection';
    rejectionReason?: string | null;
  }): Promise<void> {
    try {
      const embeddingModel = await this.modelSelector.getEmbeddingModel();
      const complaintRows = await this.dataSource.query(
        `SELECT COALESCE(NULLIF("normalizedText", ''), "rawText") AS text FROM complaint WHERE id = $1`,
        [params.complaintId],
      );
      // Defensive fallback only — every reviewed complaint has rawText
      const embeddingTarget =
        ((complaintRows as Array<{ text: string | null }>)[0]?.text ?? '').trim() || params.aiText;
      const { embedding } = await embed({ model: embeddingModel, value: embeddingTarget });

      const correctionCategory =
        params.feedbackType === 'rejection' ? 'rejection' : 'response_edit';
      // Weight 0.5 for rejection: weaker training signal than correction (no replacement text provided)
      const correctionWeight = params.feedbackType === 'rejection' ? 0.5 : 1.0;

      await this.dataSource.query(
        `INSERT INTO "human_feedback_memory"
           ("id","aiText","humanText","diffDescription","correctionCategory","correctionWeight","embedding","complaintId","tipologyId","feedbackType","rejectionReason")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::vector,$7,$8,$9,$10)`,
        [
          params.aiText,
          params.humanText,
          params.diffDescription,
          correctionCategory,
          correctionWeight,
          pgvector.toSql(embedding),
          params.complaintId,
          params.tipologyId ?? null,
          params.feedbackType,
          params.rejectionReason ?? null,
        ],
      );
    } catch (err) {
      this.logger.error('[MemoryFeedback] persistFeedback failed', err);
    }
  }
}
