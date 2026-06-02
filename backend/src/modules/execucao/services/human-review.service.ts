import { Injectable, HttpException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HumanReview, HumanReviewStatus } from '../entities/human-review.entity';
import { StepExecution, StepExecutionStatus } from '../entities/step-execution.entity';
import { TicketExecution, TicketExecutionStatus } from '../entities/ticket-execution.entity';
import { StepDefinition } from '../../orquestracao/entities/step-definition.entity';
import { Artifact } from '../entities/artifact.entity';
import { Complaint } from '../../operacao/entities/complaint.entity';
import { TicketLock } from '../../operacao/entities/ticket-lock.entity';
import { diffWords } from 'diff';
import { SubmitReviewDto } from '../dto/submit-review.dto';
import { MemoryFeedbackService } from '../../memoria/services/memory-feedback.service';
import { TicketExecutionService } from './ticket-execution.service';
import { TimingEventService } from '../../operacao/services/timing-event.service';
import { ComplaintService } from '../../operacao/services/complaint.service';

// ---------------------------------------------------------------------------
// HitlPolicyService — risk-aware HITL gate
// ---------------------------------------------------------------------------

@Injectable()
export class HitlPolicyService {
  /**
   * Returns true if this step requires human review.
   * Only triggers on the explicit isHumanRequired flag — risk level does NOT
   * override individual steps, it only adds context for the designated HITL step.
   */
  shouldRequireHumanReview(
    isHumanRequired: boolean,
    _riskLevel: string | null,
  ): boolean {
    return isHumanRequired;
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

    @InjectRepository(TicketExecution)
    private readonly ticketExecRepo: Repository<TicketExecution>,

    @InjectRepository(StepDefinition)
    private readonly stepDefinitionRepo: Repository<StepDefinition>,

    private readonly memoryFeedback: MemoryFeedbackService,

    private readonly timingEvents: TimingEventService,

    private readonly moduleRef: ModuleRef,

    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,

    @InjectRepository(TicketLock)
    private readonly lockRepo: Repository<TicketLock>,

    private readonly complaintService: ComplaintService,
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
   * Finds the most recently paused human-review step for a given complaint.
   * Used by the convenience POST /api/complaints/:complaintId/validate endpoint
   * so the UI only needs complaintId (resolved from protocol), not stepExecId.
   */
  async findLatestPausedHumanStepExec(complaintId: string): Promise<StepExecution | null> {
    return this.stepExecRepo
      .createQueryBuilder('se')
      .innerJoin('se.ticketExecution', 'te')
      .where('te.complaintId = :cid', { cid: complaintId })
      .andWhere('se.status = :s', { s: StepExecutionStatus.WAITING_HUMAN })
      .orderBy('se.createdAt', 'DESC')
      .getOne();
  }

  /**
   * Creates a HumanReview row for the given step execution.
   * Handles three decision branches: approved / corrected / rejected.
   *
   * Common to all 3 branches:
   *   - Emits 'decision_made' timing event with reviewerUserId
   *   - Sets complaint.responsavelFinal = reviewerUserId
   *   - Releases ticket lock
   *
   * Branch-specific:
   *   - approved:  marks step COMPLETED, resumes auto-advance loop
   *   - corrected: marks step COMPLETED with human-corrected output; persists memory (correction)
   *   - rejected:  marks step FAILED, cancels ticket_execution; persists memory (rejection)
   */
  async createReview(
    stepExecutionId: string,
    complaintId: string,
    reviewerUserId: string,
    dto: SubmitReviewDto,
  ): Promise<HumanReview> {
    // Normalize field names: frontend sends humanFinal/checklist; legacy sends humanFinalText/checklistItems
    const humanFinalText = dto.humanFinal ?? dto.humanFinalText ?? null;
    const checklistItems = dto.checklist ?? dto.checklistItems ?? null;

    // 1. Load ART-09 (final_response) to get aiGeneratedText
    const finalResponseArtifact = await this.artifactRepo.findOne({
      where: { complaintId, artifactType: 'final_response' },
      order: { createdAt: 'DESC' },
    });
    const aiGeneratedText =
      (finalResponseArtifact?.content?.['finalResponse'] as string) ?? '';

    // 2. Compute diff if human edited the text
    let diffSummary: string | null = null;

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

    // 3. Derive decision from new field OR legacy approved boolean
    //    If neither provided, fall through to 'corrected' (safest default when no approval signal)
    const decision: 'approved' | 'corrected' | 'rejected' =
      dto.decision ?? (dto.approved ? 'approved' : 'corrected');

    // Validation guards
    if (decision === 'rejected' && !dto.rejectionReason?.trim()) {
      throw new HttpException('rejectionReason is required when decision=rejected', 400);
    }
    if (decision === 'corrected' && !humanFinalText?.trim()) {
      throw new HttpException('humanFinal is required when decision=corrected', 400);
    }
    if (
      dto.aiResponseRating === undefined ||
      dto.aiResponseRating === null ||
      dto.aiResponseRating < 1 ||
      dto.aiResponseRating > 3
    ) {
      throw new HttpException('aiResponseRating is required (1-3)', 400);
    }

    const statusMap: Record<typeof decision, HumanReviewStatus> = {
      approved: HumanReviewStatus.APPROVED,
      corrected: HumanReviewStatus.CORRECTED,
      rejected: HumanReviewStatus.REJECTED,
    };

    // 4. Persist HumanReview row
    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        stepExecutionId,
        complaintId,
        reviewerUserId,
        status: statusMap[decision],
        aiGeneratedText,
        humanFinalText,
        diffSummary,
        correctionReason: dto.correctionReason ?? null,
        rejectionReason: decision === 'rejected' ? (dto.rejectionReason ?? null) : null,
        checklistItems: checklistItems ?? null,
        observations: dto.observations ?? null,
        aiResponseRating: dto.aiResponseRating,
        checklistCompleted:
          checklistItems != null && Object.keys(checklistItems).length > 0,
        reviewedAt: new Date(), // ALL 3 decisions are "reviewed" actions
      }),
    );

    // 5. Update ART-11 (human_diff artifact) with real diff data
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

    // 6. ALL decisions: emit decision_made timing event, release lock, set responsavelFinal
    const stepExecForEvents = await this.stepExecRepo.findOne({
      where: { id: stepExecutionId },
      relations: ['ticketExecution', 'ticketExecution.complaint'],
    });
    const executionId = stepExecForEvents?.ticketExecutionId ?? null;
    const tipologyId = stepExecForEvents?.ticketExecution?.complaint?.tipologyId ?? null;
    const now = new Date();

    try {
      // 6.a decision_made timing event (all decisions — feeds /admin/observability/human-review-avg-time)
      await this.timingEvents.emit('decision_made', complaintId, executionId, reviewerUserId, now);

      // 6.b Set complaint.responsavelFinal = reviewer (audit attribution)
      await this.complaintRepo.update({ id: complaintId }, { responsavelFinal: reviewerUserId });

      // 6.c Release lock — direct repo.delete avoids cross-module role check;
      //     the operator who just decided is implicitly authorized.
      await this.lockRepo.delete({ complaintId });
    } catch (err) {
      console.error('[HumanReviewService] common-side-effects failed', err);
      // Non-fatal — review row is already saved; admin can repair via /admin/audit
    }

    // 6.5. Persist the compliance score the operator actually saw at decision
    //      time. The initial `compliance_evaluation` artifact (from the
    //      ComplianceCheck skill) only evaluated the IA draft via LLM, so it
    //      doesn't credit the operator note / parameters / human edits. The
    //      live `/compliance-recheck` does — that's what was showing 100% on
    //      /validar. Capture that score now so re-opening the ticket via
    //      /admin/analytics/tickets/:id (latest artifact wins) returns the
    //      same number the operator saw, not the stale draft-only score.
    if (decision === 'approved' || decision === 'corrected') {
      try {
        const draftForRecheck = humanFinalText ?? aiGeneratedText ?? undefined;
        const recheck = await this.complaintService.recomputeCompliance(complaintId, draftForRecheck);
        await this.artifactRepo.save(
          this.artifactRepo.create({
            artifactType: 'compliance_evaluation',
            content: {
              isCompliant: recheck.isCompliant,
              complianceScore: recheck.complianceScore,
              violations: [],
              mandatoryFieldsStatus: recheck.mandatoryFieldsStatus,
              recommendations: [],
              source: 'human_decision_recheck',
              decision,
            },
            version: 1,
            stepExecutionId,
            complaintId,
          }),
        );
      } catch (err) {
        console.error('[HumanReviewService] compliance-recheck persistence failed', err);
        // Non-fatal — the review still went through; analytics will fall back
        // to the older LLM-based compliance artifact.
      }
    }

    // 7. Branch-specific resumption / cancellation logic
    if (decision === 'approved') {
      try {
        const stepExec = await this.stepExecRepo.findOne({ where: { id: stepExecutionId } });
        await this.timingEvents.emit('approved', complaintId, executionId, reviewerUserId, now);
        if (stepExec && stepExec.status === StepExecutionStatus.WAITING_HUMAN) {
          stepExec.status = StepExecutionStatus.COMPLETED;
          stepExec.completedAt = new Date();
          stepExec.output = {
            finalResponse: humanFinalText ?? aiGeneratedText,
            source: 'human_approved',
            aiDraft: aiGeneratedText,
          };
          await this.stepExecRepo.save(stepExec);

          // Resume ticket_execution: advance to next step
          const execution = await this.ticketExecRepo.findOne({
            where: { id: stepExec.ticketExecutionId },
          });
          if (execution && execution.status === TicketExecutionStatus.PAUSED_HUMAN) {
            const steps = await this.stepDefinitionRepo.find({
              where: { capabilityVersionId: execution.capabilityVersionId, isActive: true },
              order: { stepOrder: 'ASC' },
            });
            const currentIdx = steps.findIndex((s) => s.key === execution.currentStepKey);
            const nextStep = steps[currentIdx + 1] ?? null;

            // Accumulate output in metadata
            const meta = (execution.metadata ?? {}) as Record<string, unknown>;
            const stepOutputs = (meta.stepOutputs ?? {}) as Record<string, unknown>;
            stepOutputs[execution.currentStepKey!] = stepExec.output;
            meta.stepOutputs = stepOutputs;

            execution.status = TicketExecutionStatus.RUNNING;
            execution.currentStepKey = nextStep?.key ?? null;
            execution.metadata = meta;

            if (!nextStep) {
              execution.status = TicketExecutionStatus.COMPLETED;
              execution.completedAt = new Date();
            }

            await this.ticketExecRepo.save(execution);

            // Fire-and-forget: continue auto-advance for remaining steps
            if (nextStep) {
              setImmediate(() => {
                const svc = this.moduleRef.get(TicketExecutionService, { strict: false });
                svc.autoAdvanceLoop(execution.id).catch((e: unknown) =>
                  console.error('[HumanReview] auto-advance failed:', e),
                );
              });
            }
          }
        }
      } catch (err) {
        console.error('[HumanReviewService] Failed to resume execution after approve', err);
      }
    }

    if (decision === 'corrected') {
      try {
        const stepExec = await this.stepExecRepo.findOne({ where: { id: stepExecutionId } });
        if (stepExec && stepExec.status === StepExecutionStatus.WAITING_HUMAN) {
          stepExec.status = StepExecutionStatus.COMPLETED;
          stepExec.completedAt = new Date();
          stepExec.output = {
            finalResponse: humanFinalText!,
            source: 'human_corrected',
            aiDraft: aiGeneratedText,
            correctionReason: dto.correctionReason,
          };
          await this.stepExecRepo.save(stepExec);

          // Resume execution (same logic as approve — correction means "go ahead with human version")
          const execution = await this.ticketExecRepo.findOne({
            where: { id: stepExec.ticketExecutionId },
          });
          if (execution && execution.status === TicketExecutionStatus.PAUSED_HUMAN) {
            const steps = await this.stepDefinitionRepo.find({
              where: { capabilityVersionId: execution.capabilityVersionId, isActive: true },
              order: { stepOrder: 'ASC' },
            });
            const currentIdx = steps.findIndex((s) => s.key === execution.currentStepKey);
            const nextStep = steps[currentIdx + 1] ?? null;

            const meta = (execution.metadata ?? {}) as Record<string, unknown>;
            const stepOutputs = (meta.stepOutputs ?? {}) as Record<string, unknown>;
            stepOutputs[execution.currentStepKey!] = stepExec.output;
            meta.stepOutputs = stepOutputs;

            execution.status = TicketExecutionStatus.RUNNING;
            execution.currentStepKey = nextStep?.key ?? null;
            execution.metadata = meta;

            if (!nextStep) {
              execution.status = TicketExecutionStatus.COMPLETED;
              execution.completedAt = new Date();
            }

            await this.ticketExecRepo.save(execution);

            if (nextStep) {
              setImmediate(() => {
                const svc = this.moduleRef.get(TicketExecutionService, { strict: false });
                svc.autoAdvanceLoop(execution.id).catch((e: unknown) =>
                  console.error('[HumanReview] auto-advance failed after correction:', e),
                );
              });
            }
          }
        }
      } catch (err) {
        console.error('[HumanReviewService] Failed to resume execution after correction', err);
      }
    }

    if (decision === 'rejected') {
      try {
        const stepExec = await this.stepExecRepo.findOne({ where: { id: stepExecutionId } });
        if (stepExec) {
          stepExec.status = StepExecutionStatus.FAILED;
          stepExec.completedAt = new Date();
          stepExec.errorMessage = `Rejected by operator: ${dto.rejectionReason ?? ''}`;
          stepExec.output = {
            source: 'human_rejected',
            aiDraft: aiGeneratedText,
            rejectionReason: dto.rejectionReason ?? null,
          };
          await this.stepExecRepo.save(stepExec);
        }
        // Cancel the ticket execution — operator decided draft cannot be salvaged.
        if (executionId) {
          await this.ticketExecRepo.update(
            { id: executionId },
            { status: TicketExecutionStatus.CANCELLED, completedAt: new Date() },
          );
        }
      } catch (err) {
        console.error('[HumanReviewService] Failed to cancel execution after reject', err);
      }
    }

    // 8. Persist human feedback for future memory retrieval (corrections + rejections only).
    //    Approved path intentionally does NOT persist — only negative signals train the model.
    //
    //    Rejection persistence semantics:
    //      humanText = '' (no human replacement text exists for rejections)
    //      diffDescription = rejectionReason (the WHY of rejection — used by prompt builder similarity search)
    //      rejectionReason column = same value (used by /admin/feedback for display)
    //    Dual-write is intentional: diffDescription is the generic field for prompt builder;
    //    rejectionReason is the explicit field that downstream consumers should prefer.
    if (decision === 'corrected' || decision === 'rejected') {
      void this.memoryFeedback
        .persistFeedback({
          aiText: aiGeneratedText,
          humanText: decision === 'corrected' ? (humanFinalText ?? '') : '',
          diffDescription:
            decision === 'rejected'
              ? (dto.rejectionReason ?? '')
              : (dto.correctionReason ?? diffSummary ?? ''),
          complaintId,
          tipologyId,
          feedbackType: decision === 'corrected' ? 'correction' : 'rejection',
          rejectionReason: decision === 'rejected' ? (dto.rejectionReason ?? null) : null,
        })
        .catch((err) => console.error('[MemoryFeedback] persist failed', err));
    }

    return review;
  }

  /**
   * Returns the existing HumanReview for a step execution, or null if none exists.
   */
  async getReview(stepExecutionId: string): Promise<HumanReview | null> {
    return this.reviewRepo.findOne({ where: { stepExecutionId } });
  }
}
