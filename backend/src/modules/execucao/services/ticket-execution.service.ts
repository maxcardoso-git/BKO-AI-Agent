import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TicketExecution, TicketExecutionStatus } from '../entities/ticket-execution.entity';
import { StepExecution, StepExecutionStatus } from '../entities/step-execution.entity';
import { StepDefinition } from '../../orquestracao/entities/step-definition.entity';
import { StepSkillBinding } from '../../orquestracao/entities/step-skill-binding.entity';
import { SkillDefinition } from '../../orquestracao/entities/skill-definition.entity';
import { Complaint, ComplaintStatus } from '../../operacao/entities/complaint.entity';
import { Artifact } from '../entities/artifact.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { RegulatoryOrchestrationService } from '../../orquestracao/services/regulatory-orchestration.service';
import { ComplaintParsingAgent } from '../../ia/services/complaint-parsing.agent';
import { DraftGeneratorAgent } from '../../ia/services/draft-generator.agent';
import { ComplianceEvaluatorAgent } from '../../ia/services/compliance-evaluator.agent';
import { FinalResponseComposerAgent } from '../../ia/services/final-response-composer.agent';
import { TokenUsageTrackerService } from '../../ia/services/token-usage-tracker.service';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';
import { TemplateResolverService } from '../../base-de-conhecimento/services/template-resolver.service';
import { MandatoryInfoResolverService } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';

interface ExecutionContext {
  tipologyKey: string;
  situationKey: string | null;
  slaBusinessDays: number;
  slaDeadline: string;
  selectedActionKey: string | null;
  stepOutputs: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

@Injectable()
export class TicketExecutionService {
  constructor(
    @InjectRepository(TicketExecution)
    private readonly ticketExecutionRepo: Repository<TicketExecution>,

    @InjectRepository(StepExecution)
    private readonly stepExecutionRepo: Repository<StepExecution>,

    @InjectRepository(StepDefinition)
    private readonly stepDefinitionRepo: Repository<StepDefinition>,

    @InjectRepository(StepSkillBinding)
    private readonly stepSkillBindingRepo: Repository<StepSkillBinding>,

    @InjectRepository(SkillDefinition)
    private readonly skillDefinitionRepo: Repository<SkillDefinition>,

    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,

    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,

    private readonly orchService: RegulatoryOrchestrationService,

    // --- AI agents and KB services (added in Phase 4) ---
    private readonly complaintParser: ComplaintParsingAgent,
    private readonly draftGenerator: DraftGeneratorAgent,
    private readonly complianceEvaluator: ComplianceEvaluatorAgent,
    private readonly finalResponseComposer: FinalResponseComposerAgent,
    private readonly tokenUsageTracker: TokenUsageTrackerService,
    private readonly vectorSearch: VectorSearchService,
    private readonly templateResolver: TemplateResolverService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
  ) {}

  /**
   * Creates a new TicketExecution for the complaint. Computes SLA, selects the active
   * capability version, and sets the first step as currentStepKey.
   * Throws 409 if an active execution already exists for the complaint.
   */
  async startExecution(complaintId: string): Promise<TicketExecution> {
    // 1. Load complaint with relations
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['tipology', 'situation'],
    });

    if (!complaint) {
      throw new HttpException('Complaint not found', 404);
    }

    if (!complaint.tipologyId) {
      throw new HttpException('Complaint has no tipology assigned', 422);
    }

    // 3. Concurrent execution guard
    const existingExecution = await this.ticketExecutionRepo.findOne({
      where: {
        complaintId,
        status: In([TicketExecutionStatus.RUNNING, TicketExecutionStatus.PAUSED_HUMAN]),
      },
    });

    if (existingExecution) {
      throw new HttpException('An active execution already exists for this complaint', 409);
    }

    // 5. Select capability version
    const capabilityVersion = await this.orchService.selectCapabilityVersion(complaint.tipologyId);

    // 6. Load steps sorted by stepOrder ASC (explicit sort — TypeORM relations not auto-sorted)
    const steps = await this.stepDefinitionRepo.find({
      where: { capabilityVersionId: capabilityVersion.id, isActive: true },
      order: { stepOrder: 'ASC' },
    });

    if (steps.length === 0) {
      throw new HttpException('Capability version has no active steps', 422);
    }

    // 8. Compute SLA
    const slaResult = this.orchService.computeSla(
      complaint.createdAt,
      complaint.tipology!,
      complaint.situation ?? null,
    );

    // 9. Update complaint
    complaint.slaDeadline = slaResult.slaDeadline;
    complaint.slaBusinessDays = slaResult.slaBusinessDays;
    complaint.isOverdue = slaResult.isOverdue;
    complaint.status = ComplaintStatus.IN_PROGRESS;
    await this.complaintRepo.save(complaint);

    // 10. Build initial metadata
    const metadata: ExecutionContext = {
      tipologyKey: complaint.tipology!.key,
      situationKey: complaint.situation?.key ?? null,
      slaBusinessDays: slaResult.slaBusinessDays,
      slaDeadline: slaResult.slaDeadline.toISOString(),
      selectedActionKey: null,
      stepOutputs: {},
    };

    // 11. Create execution
    const execution = this.ticketExecutionRepo.create({
      complaintId,
      capabilityVersionId: capabilityVersion.id,
      status: TicketExecutionStatus.RUNNING,
      startedAt: new Date(),
      currentStepKey: steps[0].key,
      metadata: metadata as unknown as Record<string, unknown>,
    });

    // 12. Save
    const saved = await this.ticketExecutionRepo.save(execution as TicketExecution);

    // 13. Fire-and-forget audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        action: 'execution_started',
        entityType: 'ticket_execution',
        entityId: saved.id,
        details: { complaintId, capabilityVersionId: capabilityVersion.id },
      }),
    );

    return saved;
  }

  /**
   * Advances the execution to the next step. Executes the current step's skill,
   * writes a StepExecution record, and advances currentStepKey.
   * Pauses if isHumanRequired and no operatorInput provided.
   * Validates policy rules before executing; throws 422 if blocked.
   */
  async advanceStep(
    executionId: string,
    operatorInput?: Record<string, unknown>,
  ): Promise<StepExecution> {
    // 1. Load execution
    const execution = await this.ticketExecutionRepo.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      throw new HttpException('Execution not found', 404);
    }

    // 3. Guard status
    if (
      execution.status !== TicketExecutionStatus.RUNNING &&
      execution.status !== TicketExecutionStatus.PAUSED_HUMAN
    ) {
      throw new HttpException(
        'Execution is not in a state that can advance. Current status: ' + execution.status,
        422,
      );
    }

    // 4. Load complaint with relations
    const complaint = await this.complaintRepo.findOne({
      where: { id: execution.complaintId },
      relations: ['tipology', 'situation'],
    });

    // 5. Load all steps sorted by stepOrder ASC
    const steps = await this.stepDefinitionRepo.find({
      where: { capabilityVersionId: execution.capabilityVersionId, isActive: true },
      order: { stepOrder: 'ASC' },
    });

    // 6. Find current step
    const currentStep = steps.find((s) => s.key === execution.currentStepKey);
    if (!currentStep) {
      throw new HttpException(
        'Current step key not found: ' + execution.currentStepKey,
        422,
      );
    }

    // 7. Run policy validator
    const policyResult = await this.orchService.validatePolicyRules(complaint!, 'advance');
    if (!policyResult.passed) {
      throw new HttpException(
        { message: 'Step blocked by policy', violations: policyResult.violations },
        422,
      );
    }

    // 8. Human required pause
    if (currentStep.isHumanRequired && !operatorInput) {
      const stepExec = this.stepExecutionRepo.create({
        ticketExecutionId: executionId,
        stepDefinitionId: currentStep.id,
        stepKey: currentStep.key,
        status: StepExecutionStatus.WAITING_HUMAN,
        startedAt: new Date(),
        input: execution.metadata as Record<string, unknown>,
      });
      await this.stepExecutionRepo.save(stepExec);

      execution.status = TicketExecutionStatus.PAUSED_HUMAN;
      await this.ticketExecutionRepo.save(execution);

      complaint!.status = ComplaintStatus.WAITING_HUMAN;
      await this.complaintRepo.save(complaint!);

      return stepExec;
    }

    // 9. Resume from paused if operator provided input
    if (execution.status === TicketExecutionStatus.PAUSED_HUMAN) {
      execution.status = TicketExecutionStatus.RUNNING;
    }

    // 10. Execute the skill
    const binding = await this.stepSkillBindingRepo.findOne({
      where: { stepDefinitionId: currentStep.id, isActive: true },
      relations: ['skillDefinition'],
    });

    const skillInput: Record<string, unknown> = {
      ...(execution.metadata as Record<string, unknown>),
      ...(operatorInput ?? {}),
    };

    const startedAt = new Date();
    // 11. Create StepExecution record (saved before skill so we have stepExec.id for token tracking)
    const stepExec = this.stepExecutionRepo.create({
      ticketExecutionId: executionId,
      stepDefinitionId: currentStep.id,
      stepKey: currentStep.key,
      status: StepExecutionStatus.COMPLETED,
      startedAt,
      input: skillInput,
      retryCount: 0,
    });
    await this.stepExecutionRepo.save(stepExec);

    const output = binding
      ? await this.executeSkill(binding.skillDefinition.key, skillInput, stepExec.id)
      : { result: 'no_skill_bound' };
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 12. Update StepExecution with output and timing
    stepExec.output = output;
    stepExec.completedAt = completedAt;
    stepExec.durationMs = durationMs;
    await this.stepExecutionRepo.save(stepExec);

    // 13. Accumulate output in metadata
    const meta = ((execution.metadata ?? {}) as unknown as ExecutionContext);
    if (!meta.stepOutputs) {
      meta.stepOutputs = {};
    }
    meta.stepOutputs[currentStep.key] = output as Record<string, unknown>;

    if (
      binding?.skillDefinition.key === 'DetermineRegulatoryAction' &&
      output['actionKey']
    ) {
      meta.selectedActionKey = output['actionKey'] as string;
    }

    // 14. Determine next step (next in sorted order)
    const currentIndex = steps.findIndex((s) => s.key === currentStep.key);
    const nextStep = steps[currentIndex + 1] ?? null;

    // 15. Update execution
    execution.currentStepKey = nextStep?.key ?? null;
    execution.metadata = meta as unknown as Record<string, unknown>;

    if (!nextStep) {
      execution.status = TicketExecutionStatus.COMPLETED;
      execution.completedAt = new Date();
      execution.totalDurationMs = new Date().getTime() - execution.startedAt!.getTime();
    }

    // 16. Save execution
    await this.ticketExecutionRepo.save(execution);

    // 17. If completed, update complaint
    if (!nextStep) {
      complaint!.status = ComplaintStatus.COMPLETED;
      await this.complaintRepo.save(complaint!);
    }

    // 18. Write audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        action: 'step_completed',
        entityType: 'step_execution',
        entityId: stepExec.id,
        details: {
          stepKey: currentStep.key,
          executionId,
          status: stepExec.status,
        },
      }),
    );

    return stepExec;
  }

  /**
   * Forces the execution to COMPLETED state regardless of current step position.
   * Updates complaint to COMPLETED. Validates finalize policy rules before completing.
   */
  async finalizeExecution(
    executionId: string,
    outcome?: Record<string, unknown>,
  ): Promise<TicketExecution> {
    // 1. Load execution
    const execution = await this.ticketExecutionRepo.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      throw new HttpException('Execution not found', 404);
    }

    if (
      execution.status !== TicketExecutionStatus.RUNNING &&
      execution.status !== TicketExecutionStatus.PAUSED_HUMAN
    ) {
      throw new HttpException(
        'Execution is not in a state that can be finalized. Current status: ' + execution.status,
        422,
      );
    }

    // 2. Load complaint
    const complaint = await this.complaintRepo.findOne({
      where: { id: execution.complaintId },
      relations: ['tipology', 'situation'],
    });

    // 3. Validate finalize policy
    const policyResult = await this.orchService.validatePolicyRules(complaint!, 'finalizar');
    if (!policyResult.passed) {
      throw new HttpException(
        { message: 'Finalization blocked by policy', violations: policyResult.violations },
        422,
      );
    }

    // 4. Update execution
    const now = new Date();
    execution.status = TicketExecutionStatus.COMPLETED;
    execution.completedAt = now;
    execution.totalDurationMs = now.getTime() - execution.startedAt!.getTime();

    if (outcome) {
      const meta = (execution.metadata ?? {}) as unknown as ExecutionContext & { outcome?: Record<string, unknown> };
      meta.outcome = outcome;
      execution.metadata = meta as unknown as Record<string, unknown>;
    }

    // 5. Save execution
    await this.ticketExecutionRepo.save(execution);

    // 6. Update complaint
    complaint!.status = ComplaintStatus.COMPLETED;
    await this.complaintRepo.save(complaint!);

    // 7. Write audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        action: 'execution_finalized',
        entityType: 'ticket_execution',
        entityId: execution.id,
        details: { executionId, outcome: outcome ?? null },
      }),
    );

    return execution;
  }

  /**
   * Retries a specific step within an execution. Increments retryCount on the existing
   * StepExecution row, re-executes the skill, and restores RUNNING if was FAILED.
   */
  async retryStep(executionId: string, stepKey: string): Promise<StepExecution> {
    // 1. Load execution
    const execution = await this.ticketExecutionRepo.findOne({
      where: { id: executionId },
    });

    if (!execution) {
      throw new HttpException('Execution not found', 404);
    }

    // 2. Find StepExecution
    const stepExec = await this.stepExecutionRepo.findOne({
      where: { ticketExecutionId: executionId, stepKey },
    });

    if (!stepExec) {
      throw new HttpException('No step execution found for key: ' + stepKey, 404);
    }

    // 3. Guard: only retryable from FAILED or WAITING_HUMAN
    if (
      stepExec.status !== StepExecutionStatus.FAILED &&
      stepExec.status !== StepExecutionStatus.WAITING_HUMAN
    ) {
      throw new HttpException(
        'Step is not in a retryable state: ' + stepExec.status,
        422,
      );
    }

    // 4. Find skill binding and re-execute
    const binding = await this.stepSkillBindingRepo.findOne({
      where: { stepDefinitionId: stepExec.stepDefinitionId! },
      relations: ['skillDefinition'],
    });

    const skillInput: Record<string, unknown> = {
      ...(execution.metadata as Record<string, unknown>),
    };

    const startedAt = new Date();
    const newOutput = binding
      ? await this.executeSkill(binding.skillDefinition.key, skillInput, stepExec.id)
      : { result: 'no_skill_bound' };
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 5. Update stepExec
    stepExec.retryCount += 1;
    stepExec.status = StepExecutionStatus.COMPLETED;
    stepExec.startedAt = startedAt;
    stepExec.completedAt = completedAt;
    stepExec.durationMs = durationMs;
    stepExec.output = newOutput;
    stepExec.errorMessage = null;

    // 6. Save stepExec
    await this.stepExecutionRepo.save(stepExec);

    // 7. Restore RUNNING if execution was FAILED
    if (execution.status === TicketExecutionStatus.FAILED) {
      execution.status = TicketExecutionStatus.RUNNING;
      await this.ticketExecutionRepo.save(execution);
    }

    // 8. Update metadata.stepOutputs
    const meta = ((execution.metadata ?? {}) as unknown as ExecutionContext);
    if (!meta.stepOutputs) {
      meta.stepOutputs = {};
    }
    meta.stepOutputs[stepKey] = newOutput;
    execution.metadata = meta as unknown as Record<string, unknown>;
    await this.ticketExecutionRepo.save(execution);

    // 9. Write audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        action: 'step_retried',
        entityType: 'step_execution',
        entityId: stepExec.id,
        details: { stepKey, executionId, retryCount: stepExec.retryCount },
      }),
    );

    return stepExec;
  }

  /**
   * Async skill dispatcher. Routes to real AI agents for AI-related skills,
   * falls back to stub implementations for non-AI skills (data loading, validation, etc.).
   * Phase 5 will replace remaining stubs with full implementations.
   *
   * @param stepExecutionId - Required for TokenUsageTrackerService.track() (llm_call.stepExecutionId FK is non-nullable)
   */
  private async executeSkill(
    skillKey: string,
    input: Record<string, unknown>,
    stepExecutionId: string,
  ): Promise<Record<string, unknown>> {
    try {
      switch (skillKey) {
        // === AI-powered skills (real implementations) ===
        case 'ClassifyTypology': {
          const result = await this.complaintParser.classify(input);
          // Track token usage for LLM call
          if (result.usage) {
            const usage = result.usage as { inputTokens: number; outputTokens: number };
            await this.tokenUsageTracker.track({
              stepExecutionId,
              model: result.model as string,
              provider: result.provider as string,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              latencyMs: (result.latencyMs as number) ?? 0,
            });
          }
          return result;
        }

        case 'RetrieveManualContext': {
          const query = (input['complaintText'] as string) ??
            (input['normalizedText'] as string) ?? '';
          const chunks = await this.vectorSearch.search(query, 5, 'manual_anatel');
          return { chunks: chunks.map(c => ({ content: c.content, similarity: c.similarity })) };
        }

        case 'RetrieveIQITemplate': {
          const tipologyId = input['tipologyId'] as string | undefined;
          const situationId = input['situationId'] as string | null ?? null;
          if (!tipologyId) {
            return { templateContent: null, templateName: null, error: 'No tipologyId provided' };
          }
          const template = await this.templateResolver.resolve(tipologyId, situationId);
          return {
            templateContent: template?.templateContent ?? null,
            templateName: template?.name ?? null,
            templateId: template?.id ?? null,
            matchType: template?.matchType ?? null,
          };
        }

        case 'BuildMandatoryChecklist': {
          const tipId = input['tipologyId'] as string | undefined;
          const sitId = input['situationId'] as string | null ?? null;
          if (!tipId) {
            return { checklist: [], completionPercentage: 0, error: 'No tipologyId provided' };
          }
          const fields = await this.mandatoryInfoResolver.resolve(tipId, sitId);
          return {
            checklist: fields.map(f => ({
              fieldName: f.fieldName,
              fieldLabel: f.fieldLabel,
              isRequired: f.isRequired,
              isPresent: false, // will be checked by ComplianceCheck later
            })),
            completionPercentage: 0,
          };
        }

        case 'DraftFinalResponse': {
          const result = await this.draftGenerator.generate(input);
          // Track token usage for LLM call
          if (result.usage) {
            const usage = result.usage as { inputTokens: number; outputTokens: number };
            await this.tokenUsageTracker.track({
              stepExecutionId,
              model: result.model as string,
              provider: result.provider as string,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              latencyMs: (result.latencyMs as number) ?? 0,
            });
          }
          return result;
        }

        case 'ComplianceCheck': {
          const result = await this.complianceEvaluator.evaluate(input);
          // Track token usage for LLM call
          if (result.usage) {
            const usage = result.usage as { inputTokens: number; outputTokens: number };
            await this.tokenUsageTracker.track({
              stepExecutionId,
              model: result.model as string,
              provider: result.provider as string,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              latencyMs: (result.latencyMs as number) ?? 0,
            });
          }
          return result;
        }

        case 'GenerateArtifact': {
          const result = await this.finalResponseComposer.compose(input);
          // Track token usage for LLM call (only if composer made an LLM call — skipped when no violations)
          if (result.usage && result.model !== 'none') {
            const usage = result.usage as { inputTokens: number; outputTokens: number };
            await this.tokenUsageTracker.track({
              stepExecutionId,
              model: result.model as string,
              provider: result.provider as string,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              latencyMs: (result.latencyMs as number) ?? 0,
            });
          }
          return result;
        }

        // === Stub skills (non-AI, will be implemented in Phase 5) ===
        case 'LoadComplaint':
          return {
            complaint: { id: input['complaintId'], protocolNumber: input['protocolNumber'] ?? 'STUB' },
          };

        case 'NormalizeComplaintText':
          return {
            normalizedText: (input['rawText'] as string) ?? 'normalized stub text',
          };

        case 'ComputeSla':
          return {
            slaDeadline: new Date().toISOString(),
            slaBusinessDays: 10,
            isOverdue: false,
          };

        case 'DetermineRegulatoryAction':
          return {
            actionKey: 'responder',
            justification: 'stub determination',
          };

        case 'ApplyPersonaTone':
          return {
            adjustedText: (input['draftText'] as string) ?? 'stub adjusted text',
          };

        case 'HumanDiffCapture':
          return { diffSummary: 'no diff', changesCount: 0 };

        case 'PersistMemory':
          return { memoryId: 'stub-memory-id' };

        case 'TrackTokenUsage':
          return { totalTokens: 0, estimatedCost: 0 };

        case 'AuditTrail':
          return { auditLogId: 'stub-audit-id' };

        case 'ValidateReclassification':
          return { isValid: true, errors: [] };

        case 'ValidateReencaminhamento':
          return { isValid: true, errors: [] };

        case 'ValidateCancelamento':
          return { isValid: true, errors: [] };

        default:
          return { error: 'Unknown skill: ' + skillKey, result: 'no_op' };
      }
    } catch (error) {
      // Log error but do NOT throw — return error payload so step execution records the failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        error: errorMessage,
        skillKey,
        failedAt: new Date().toISOString(),
      };
    }
  }
}
