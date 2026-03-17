import { Controller, Post, Param, Body, HttpCode } from '@nestjs/common';
import { TicketExecutionService } from '../services/ticket-execution.service';
import { TicketExecution } from '../entities/ticket-execution.entity';
import { StepExecution } from '../entities/step-execution.entity';

@Controller()
export class TicketExecutionController {
  constructor(private readonly ticketExecutionService: TicketExecutionService) {}

  /**
   * POST /api/complaints/:id/executions
   * Starts a new execution for the given complaint.
   * Returns 201 with TicketExecution{status:running, currentStepKey, metadata:{tipologyKey, slaDeadline, stepOutputs}}
   */
  @Post('complaints/:id/executions')
  @HttpCode(201)
  async startExecution(@Param('id') complaintId: string): Promise<TicketExecution> {
    return this.ticketExecutionService.startExecution(complaintId);
  }

  /**
   * POST /api/executions/:id/advance
   * Advances the current step of the execution. Optionally accepts operatorInput for human-required steps.
   * Returns 200 with StepExecution{status:completed, output:{...stub_data}}
   */
  @Post('executions/:id/advance')
  async advanceStep(
    @Param('id') executionId: string,
    @Body() body?: { operatorInput?: Record<string, unknown> },
  ): Promise<StepExecution> {
    return this.ticketExecutionService.advanceStep(executionId, body?.operatorInput);
  }

  /**
   * POST /api/executions/:id/finalize
   * Forces the execution to COMPLETED state regardless of current step position.
   * Returns 200 with TicketExecution{status:completed, completedAt:set}
   */
  @Post('executions/:id/finalize')
  async finalizeExecution(
    @Param('id') executionId: string,
    @Body() body?: { outcome?: Record<string, unknown> },
  ): Promise<TicketExecution> {
    return this.ticketExecutionService.finalizeExecution(executionId, body?.outcome);
  }

  /**
   * POST /api/executions/:id/retry-step
   * Retries a failed or waiting_human step within an execution.
   * Returns 200 with updated StepExecution{status:completed}
   */
  @Post('executions/:id/retry-step')
  async retryStep(
    @Param('id') executionId: string,
    @Body() body: { stepKey: string },
  ): Promise<StepExecution> {
    return this.ticketExecutionService.retryStep(executionId, body.stepKey);
  }
}
