import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  HttpException,
  HttpCode,
  UseInterceptors,
} from '@nestjs/common';
import { HumanReviewService } from '../services/human-review.service';
import { SubmitReviewDto } from '../dto/submit-review.dto';
import { HumanReview } from '../entities/human-review.entity';
import { SensitiveDataInterceptor } from '../../../interceptors/sensitive-data.interceptor';

@UseInterceptors(SensitiveDataInterceptor)
@Controller()
export class HumanReviewController {
  constructor(private readonly humanReviewService: HumanReviewService) {}

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
    // Load stepExecution to resolve complaintId
    const stepExec =
      await this.humanReviewService.getStepExecution(stepExecId);

    const complaintId = stepExec.ticketExecution?.complaintId;
    if (!complaintId) {
      throw new HttpException(
        'Cannot resolve complaintId from step execution',
        422,
      );
    }

    const reviewerUserId = req.user?.sub ?? req.user?.id ?? 'unknown';
    return this.humanReviewService.createReview(
      stepExecId,
      complaintId,
      reviewerUserId,
      dto,
    );
  }

  /**
   * GET /api/executions/:execId/steps/:stepExecId/review
   * Returns existing HumanReview or 404.
   */
  @Get('executions/:execId/steps/:stepExecId/review')
  async getReview(
    @Param('stepExecId') stepExecId: string,
  ): Promise<HumanReview> {
    const review = await this.humanReviewService.getReview(stepExecId);
    if (!review) {
      throw new HttpException('HumanReview not found', 404);
    }
    return review;
  }
}
