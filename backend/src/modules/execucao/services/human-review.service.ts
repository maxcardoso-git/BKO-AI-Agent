import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HumanReview, HumanReviewStatus } from '../entities/human-review.entity';
import { StepExecution } from '../entities/step-execution.entity';
import { Artifact } from '../entities/artifact.entity';
import { diffWords } from 'diff';
import { SubmitReviewDto } from '../dto/submit-review.dto';
import { MemoryFeedbackService } from '../../memoria/services/memory-feedback.service';

// ---------------------------------------------------------------------------
// HitlPolicyService — risk-aware HITL gate
// ---------------------------------------------------------------------------

@Injectable()
export class HitlPolicyService {
  /**
   * Returns true if this step requires human review.
   * Triggers on explicit isHumanRequired flag OR if complaint riskLevel is 'high' or 'critical'.
   */
  shouldRequireHumanReview(
    isHumanRequired: boolean,
    riskLevel: string | null,
  ): boolean {
    if (isHumanRequired) return true;
    if (riskLevel === 'high' || riskLevel === 'critical') return true;
    return false;
  }
}

// ---------------------------------------------------------------------------
// HumanReviewService — review persistence + diff computation
// ---------------------------------------------------------------------------

@Injectable()
export class HumanReviewService {
  constructor(
    @InjectRepository(HumanReview)
    private readonly reviewRepo: Repository<HumanReview>,

    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,

    @InjectRepository(StepExecution)
    private readonly stepExecRepo: Repository<StepExecution>,

    private readonly memoryFeedback: MemoryFeedbackService,
  ) {}

  /**
   * Loads a StepExecution with its ticketExecution relation to resolve complaintId.
   */
  async getStepExecution(stepExecutionId: string): Promise<StepExecution> {
    const stepExec = await this.stepExecRepo.findOne({
      where: { id: stepExecutionId },
      relations: ['ticketExecution', 'ticketExecution.complaint'],
    });
    if (!stepExec) {
      throw new HttpException('StepExecution not found', 404);
    }
    return stepExec;
  }

  /**
   * Creates a HumanReview row for the given step execution.
   * - Loads aiGeneratedText from ART-09 (final_response artifact)
   * - Computes diff if humanFinalText differs from aiGeneratedText
   * - Updates ART-11 (human_diff artifact) content with real diff data
   * - Returns the saved HumanReview
   */
  async createReview(
    stepExecutionId: string,
    complaintId: string,
    reviewerUserId: string,
    dto: SubmitReviewDto,
  ): Promise<HumanReview> {
    // 1. Load ART-09 (final_response) to get aiGeneratedText
    const finalResponseArtifact = await this.artifactRepo.findOne({
      where: { complaintId, artifactType: 'final_response' },
      order: { createdAt: 'DESC' },
    });
    const aiGeneratedText =
      (finalResponseArtifact?.content?.['finalResponse'] as string) ?? '';

    // 2. Compute diff if human edited the text
    let diffSummary: string | null = null;
    const humanFinalText = dto.humanFinalText ?? null;

    if (humanFinalText && humanFinalText !== aiGeneratedText) {
      const changes = diffWords(aiGeneratedText, humanFinalText);
      const changesCount = changes.filter((c) => c.added || c.removed).length;
      const additions = changes
        .filter((c) => c.added)
        .map((c) => c.value)
        .join(' ')
        .slice(0, 500);
      const removals = changes
        .filter((c) => c.removed)
        .map((c) => c.value)
        .join(' ')
        .slice(0, 500);
      diffSummary = JSON.stringify({ changesCount, additions, removals });
    }

    // 3. Persist HumanReview row
    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        stepExecutionId,
        complaintId,
        reviewerUserId,
        status: dto.approved
          ? HumanReviewStatus.APPROVED
          : HumanReviewStatus.PENDING,
        aiGeneratedText,
        humanFinalText,
        diffSummary,
        correctionReason: dto.correctionReason ?? null,
        checklistItems: dto.checklistItems ?? null,
        observations: dto.observations ?? null,
        checklistCompleted:
          dto.checklistItems != null &&
          Object.keys(dto.checklistItems).length > 0,
        reviewedAt: dto.approved ? new Date() : null,
      }),
    );

    // 4. Update ART-11 (human_diff artifact) with real diff data
    const humanDiffArtifact = await this.artifactRepo.findOne({
      where: { complaintId, artifactType: 'human_diff' },
      order: { createdAt: 'DESC' },
    });
    if (humanDiffArtifact) {
      const parsedDiff = diffSummary ? JSON.parse(diffSummary) : { changesCount: 0 };
      humanDiffArtifact.content = {
        diffSummary: review.diffSummary,
        changesCount: parsedDiff.changesCount ?? 0,
        aiDraft: aiGeneratedText,
        humanFinal: humanFinalText,
        correctionReason: dto.correctionReason ?? null,
      };
      await this.artifactRepo.save(humanDiffArtifact);
    }

    // 5. Fire-and-forget: persist human feedback for future memory retrieval (MEM-04)
    // Load stepExec to get tipologyId via ticketExecution.complaint relation
    const stepExecWithComplaint = await this.stepExecRepo.findOne({
      where: { id: stepExecutionId },
      relations: ['ticketExecution', 'ticketExecution.complaint'],
    });
    void this.memoryFeedback.persistFeedback(
      aiGeneratedText,
      dto.humanFinalText ?? aiGeneratedText,
      diffSummary ?? '',
      complaintId,
      stepExecWithComplaint?.ticketExecution?.complaint?.tipologyId ?? null,
    ).catch(err => console.error('[MemoryFeedback] persist failed', err));

    return review;
  }

  /**
   * Returns the existing HumanReview for a step execution, or null if none exists.
   */
  async getReview(stepExecutionId: string): Promise<HumanReview | null> {
    return this.reviewRepo.findOne({ where: { stepExecutionId } });
  }
}
