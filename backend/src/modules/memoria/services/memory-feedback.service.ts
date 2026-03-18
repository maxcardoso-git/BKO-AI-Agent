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
   * Persists a human correction as a HumanFeedbackMemory row with pgvector embedding.
   * The human-corrected text is embedded so future searches find corrections similar
   * to the human's approved version.
   *
   * Non-critical: errors are logged but not re-thrown to avoid breaking the review flow.
   */
  async persistFeedback(
    aiText: string,
    humanText: string,
    diffDescription: string,
    complaintId: string,
    tipologyId: string | null,
  ): Promise<void> {
    try {
      const embeddingModel = await this.modelSelector.getEmbeddingModel();
      const { embedding } = await embed({ model: embeddingModel, value: humanText });

      await this.dataSource.query(
        `INSERT INTO "human_feedback_memory"
           ("id","aiText","humanText","diffDescription","correctionCategory","correctionWeight","embedding","complaintId","tipologyId")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::vector,$7,$8)
         RETURNING "id"`,
        [
          aiText,
          humanText,
          diffDescription,
          'response_edit',
          1.0,
          pgvector.toSql(embedding),
          complaintId,
          tipologyId ?? null,
        ],
      );
    } catch (err) {
      this.logger.error('[MemoryFeedback] persistFeedback failed', err);
    }
  }
}
