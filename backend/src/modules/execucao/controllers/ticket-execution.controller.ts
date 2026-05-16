import { Controller, Post, Get, Param, Body, HttpCode } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketExecutionService } from '../services/ticket-execution.service';
import { SkillRegistryService } from '../services/skill-registry.service';
import { TicketExecution } from '../entities/ticket-execution.entity';
import { StepExecution } from '../entities/step-execution.entity';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';

@Controller()
export class TicketExecutionController {
  constructor(
    private readonly ticketExecutionService: TicketExecutionService,
    private readonly skillRegistryService: SkillRegistryService,
    @InjectRepository(StepExecution)
    private readonly stepExecutionRepo: Repository<StepExecution>,
  ) {}

  /**
   * POST /api/complaints/:id/sentiment-preview
   * Runs the customer sentiment analysis on demand (cached as artifact).
   */
  @Post('complaints/:id/sentiment-preview')
  @HttpCode(200)
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  async previewSentiment(@Param('id') complaintId: string) {
    return this.skillRegistryService.previewCustomerSentiment(complaintId);
  }

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
   * OPERATOR can poll this for progress tracking; full artifact detail is on /review (SUPERVISOR+).
   */
  @Get('executions/:execId/steps')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
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

  /**
   * GET /api/executions/:execId/collected-data
   * Returns completed step outputs as display blocks for the HITL review page.
   */
  @Get('executions/:execId/collected-data')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  async getCollectedData(
    @Param('execId') execId: string,
  ): Promise<{ executionId: string; blocks: Record<string, unknown>[] }> {
    const steps = await this.stepExecutionRepo.find({
      where: { ticketExecutionId: execId },
      order: { createdAt: 'ASC' },
    });

    const STEP_META: Record<string, { title: string; color: string }> = {
      load_complaint:      { title: 'Reclamação Carregada',     color: '#6366f1' },
      normalize_text:      { title: 'Texto Normalizado',        color: '#8b5cf6' },
      classify_tipology:   { title: 'Tipologia Classificada',   color: '#ec4899' },
      compute_sla:         { title: 'SLA Calculado',            color: '#f59e0b' },
      determine_action:    { title: 'Ação Determinada',         color: '#10b981' },
      build_checklist:     { title: 'Checklist Montado',        color: '#14b8a6' },
      retrieve_context:    { title: 'Contexto Recuperado',      color: '#3b82f6' },
      compliance_check:    { title: 'Verificação de Conformidade', color: '#f97316' },
      draft_response:      { title: 'Rascunho Gerado',          color: '#84cc16' },
      apply_persona:       { title: 'Persona Aplicada',         color: '#06b6d4' },
      audit_persist:       { title: 'Auditoria Registrada',     color: '#64748b' },
      human_review:        { title: 'Revisão Humana',           color: '#a855f7' },
    };

    const blocks = steps
      .filter((s) => s.status === 'completed' && s.output)
      .map((s) => {
        const meta = STEP_META[s.stepKey] ?? { title: s.stepKey, color: '#94a3b8' };
        const output = s.output as Record<string, unknown>;
        const fields = Object.entries(output)
          .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
          .map(([label, value]) => ({ label, value: String(value) }));
        // Arrays become items; each item must have a `fields` array for the UI
        const items = Object.entries(output)
          .filter(([, v]) => Array.isArray(v))
          .flatMap(([key, arr]) =>
            (arr as unknown[]).map((item) => {
              if (typeof item === 'object' && item !== null) {
                const itemFields = Object.entries(item as Record<string, unknown>)
                  .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                  .map(([label, value]) => ({ label, value: String(value) }));
                return { fields: itemFields };
              }
              return { fields: [{ label: key, value: String(item) }] };
            }),
          );
        return { id: s.id, title: meta.title, color: meta.color, fields, items };
      });

    return { executionId: execId, blocks };
  }
}
