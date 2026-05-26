import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  HttpException,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HumanReviewService } from '../services/human-review.service';
import { SubmitReviewDto } from '../dto/submit-review.dto';
import { HumanReview } from '../entities/human-review.entity';
import { StepExecution } from '../entities/step-execution.entity';
import { Artifact } from '../entities/artifact.entity';

// SensitiveDataInterceptor removed — internal operators see unmasked data.
@Controller()
export class HumanReviewController {
  constructor(
    private readonly humanReviewService: HumanReviewService,
    @InjectRepository(StepExecution)
    private readonly stepExecutionRepo: Repository<StepExecution>,
    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,
  ) {}

  /**
   * POST /api/executions/:execId/steps/:stepExecId/review
   * Persists a HumanReview row, computes diff, and updates ART-11.
   * Returns the saved HumanReview (201).
   */
  @Post('executions/:execId/steps/:stepExecId/review')
  @HttpCode(201)
  async submitReview(
    @Param('execId') _execId: string,
    @Param('stepExecId') stepExecId: string,
    @Body() dto: SubmitReviewDto,
    @Request() req: { user?: { sub?: string; id?: string } },
  ): Promise<HumanReview> {
    const stepExec = await this.humanReviewService.getStepExecution(stepExecId);
    const complaintId = stepExec.ticketExecution?.complaintId;
    if (!complaintId) {
      throw new HttpException('Cannot resolve complaintId from step execution', 422);
    }
    const reviewerUserId = req.user?.sub ?? req.user?.id ?? 'unknown';
    return this.humanReviewService.createReview(stepExecId, complaintId, reviewerUserId, dto);
  }

  /**
   * POST /api/complaints/:complaintId/validate
   * Convenience endpoint — resolves the latest paused HITL step from complaintId
   * so the UI only needs complaintId (resolved from protocol lookup), not stepExecId.
   */
  @Post('complaints/:complaintId/validate')
  @HttpCode(200)
  async validate(
    @Param('complaintId') complaintId: string,
    @Body() dto: SubmitReviewDto,
    @Request() req: { user?: { sub?: string; id?: string } },
  ): Promise<HumanReview> {
    const stepExec = await this.humanReviewService.findLatestPausedHumanStepExec(complaintId);
    if (!stepExec) throw new NotFoundException('No paused review for this complaint');
    const reviewerUserId = req.user?.sub ?? req.user?.id ?? 'unknown';
    return this.humanReviewService.createReview(stepExec.id, complaintId, reviewerUserId, dto);
  }

  /**
   * GET /api/executions/:execId/steps/:stepExecId/review
   * Returns existing HumanReview mapped to frontend shape.
   * If no review submitted yet, returns AI draft from step output so the page can populate.
   */
  @Get('executions/:execId/steps/:stepExecId/review')
  async getReview(
    @Param('stepExecId') stepExecId: string,
  ): Promise<Record<string, unknown>> {
    const review = await this.humanReviewService.getReview(stepExecId);

    if (review) {
      return {
        ...review,
        aiDraft: review.aiGeneratedText ?? '',
        humanFinal: review.humanFinalText ?? review.aiGeneratedText ?? '',
      } as unknown as Record<string, unknown>;
    }

    // No review yet — build preview from step execution output or final_response artifact
    const stepExec = await this.stepExecutionRepo.findOne({
      where: { id: stepExecId },
      relations: ['ticketExecution'],
    });
    if (!stepExec) {
      throw new HttpException('HumanReview not found', 404);
    }

    const output = stepExec.output as Record<string, unknown> | null;
    let aiDraft =
      (output?.['draftResponse'] as string) ??
      (output?.['finalResponse'] as string) ??
      '';

    // Fallback: look in artifacts for final_response or draft_response
    if (!aiDraft) {
      const complaintId = stepExec.ticketExecution?.complaintId;
      if (complaintId) {
        // Try final_response first (saved during HITL pause), then draft_response artifact
        for (const artifactType of ['final_response', 'draft_response']) {
          const artifact = await this.artifactRepo.findOne({
            where: { complaintId, artifactType },
            order: { createdAt: 'DESC' },
          });
          const artContent = artifact?.content as Record<string, unknown> | null;
          aiDraft =
            (artContent?.['finalResponse'] as string) ??
            (artContent?.['draftResponse'] as string) ??
            '';
          if (aiDraft) break;
        }
      }
    }

    return {
      id: null,
      stepExecutionId: stepExecId,
      aiDraft,
      humanFinal: aiDraft,
      diffSummary: null,
      correctionReason: null,
      checklist: null,
      approvedAt: null,
    };
  }
}
