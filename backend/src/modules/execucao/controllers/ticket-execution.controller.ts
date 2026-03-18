import { Controller, Post, Get, Param, Body, HttpCode } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketExecutionService } from '../services/ticket-execution.service';
import { TicketExecution } from '../entities/ticket-execution.entity';
import { StepExecution } from '../entities/step-execution.entity';

@Controller()
export class TicketExecutionController {
  constructor(
    private readonly ticketExecutionService: TicketExecutionService,
    @InjectRepository(StepExecution)
    private readonly stepExecutionRepo: Repository<StepExecution>,
  ) {}

  /**
   * POST /api/complaints/:id/executions/start
   * Starts a new execution for the given complaint (frontend-facing route).
   */
  @Post('complaints/:id/executions/start')
  @HttpCode(201)
  async startExecutionV2(@Param('id') complaintId: string): Promise<TicketExecution> {
    return this.ticketExecutionService.startExecution(complaintId);
  }

  /**
   * POST /api/complaints/:id/executions
   * Starts a new execution (legacy route, kept for backward compatibility).
   */
  @Post('complaints/:id/executions')
  @HttpCode(201)
  async startExecution(@Param('id') complaintId: string): Promise<TicketExecution> {
    return this.ticketExecutionService.startExecution(complaintId);
  }

  /**
   * GET /api/executions/:execId/steps
   * Returns all step executions for a given execution, ordered by createdAt.
   */
  @Get('executions/:execId/steps')
  async listSteps(@Param('execId') execId: string): Promise<StepExecution[]> {
    return this.stepExecutionRepo.find({
      where: { ticketExecutionId: execId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * POST /api/executions/:id/steps/:stepKey/advance
   * Advances the current step, then fires auto-advance for remaining non-human steps.
   */
  @Post('executions/:id/steps/:stepKey/advance')
  async advanceStepV2(
    @Param('id') executionId: string,
    @Body() body?: { operatorInput?: Record<string, unknown> },
  ): Promise<StepExecution> {
    const result = await this.ticketExecutionService.advanceStep(executionId, body?.operatorInput);
    setImmediate(() => this.ticketExecutionService.autoAdvanceLoop(executionId).catch(() => {}));
    return result;
  }

  /**
   * POST /api/executions/:id/advance
   * Advances the current step (legacy route), then fires auto-advance.
   */
  @Post('executions/:id/advance')
  async advanceStep(
    @Param('id') executionId: string,
    @Body() body?: { operatorInput?: Record<string, unknown> },
  ): Promise<StepExecution> {
    const result = await this.ticketExecutionService.advanceStep(executionId, body?.operatorInput);
    setImmediate(() => this.ticketExecutionService.autoAdvanceLoop(executionId).catch(() => {}));
    return result;
  }

  /**
   * POST /api/executions/:id/steps/:stepKey/retry
   * Retries a failed or waiting_human step (frontend-facing route).
   */
  @Post('executions/:id/steps/:stepKey/retry')
  async retryStepV2(
    @Param('id') executionId: string,
    @Param('stepKey') stepKey: string,
  ): Promise<StepExecution> {
    return this.ticketExecutionService.retryStep(executionId, stepKey);
  }

  /**
   * POST /api/executions/:id/retry-step
   * Retries a failed step (legacy route).
   */
  @Post('executions/:id/retry-step')
  async retryStep(
    @Param('id') executionId: string,
    @Body() body: { stepKey: string },
  ): Promise<StepExecution> {
    return this.ticketExecutionService.retryStep(executionId, body.stepKey);
  }

  /**
   * POST /api/executions/:id/finalize
   * Forces the execution to COMPLETED state.
   */
  @Post('executions/:id/finalize')
  async finalizeExecution(
    @Param('id') executionId: string,
    @Body() body?: { outcome?: Record<string, unknown> },
  ): Promise<TicketExecution> {
    return this.ticketExecutionService.finalizeExecution(executionId, body?.outcome);
  }
}
