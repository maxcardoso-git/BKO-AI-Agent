import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { generateObject, embed } from 'ai';
import * as pgvector from 'pgvector/pg';
import { z } from 'zod';
import { Artifact } from '../entities/artifact.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Complaint } from '../../operacao/entities/complaint.entity';
import { Persona } from '../../regulatorio/entities/persona.entity';
import { CaseMemory } from '../../memoria/entities/case-memory.entity';
import { HumanFeedbackMemory } from '../../memoria/entities/human-feedback-memory.entity';
import { ComplaintParsingAgent } from '../../ia/services/complaint-parsing.agent';
import { DraftGeneratorAgent } from '../../ia/services/draft-generator.agent';
import { ComplianceEvaluatorAgent } from '../../ia/services/compliance-evaluator.agent';
import { FinalResponseComposerAgent } from '../../ia/services/final-response-composer.agent';
import { TokenUsageTrackerService } from '../../ia/services/token-usage-tracker.service';
import { ModelSelectorService } from '../../ia/services/model-selector.service';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';
import { TemplateResolverService } from '../../base-de-conhecimento/services/template-resolver.service';
import { MandatoryInfoResolverService } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';

const DetermineActionSchema = z.object({
  actionKey: z.enum(['responder', 'reclassificar', 'reencaminhar', 'cancelar']),
  justification: z.string().describe('Justificativa para a acao regulatoria escolhida'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianca na decisao'),
});

@Injectable()
export class SkillRegistryService {
  private readonly logger = new Logger(SkillRegistryService.name);

  constructor(
    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,

    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,

    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,

    @InjectRepository(CaseMemory)
    private readonly caseMemoryRepo: Repository<CaseMemory>,

    @InjectRepository(HumanFeedbackMemory)
    private readonly humanFeedbackRepo: Repository<HumanFeedbackMemory>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    // AI agents
    private readonly complaintParser: ComplaintParsingAgent,
    private readonly draftGenerator: DraftGeneratorAgent,
    private readonly complianceEvaluator: ComplianceEvaluatorAgent,
    private readonly finalResponseComposer: FinalResponseComposerAgent,
    private readonly tokenUsageTracker: TokenUsageTrackerService,
    private readonly modelSelector: ModelSelectorService,

    // KB services
    private readonly vectorSearch: VectorSearchService,
    private readonly templateResolver: TemplateResolverService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
  ) {}

  /**
   * Central skill dispatcher. Routes skillKey to the appropriate implementation.
   * @param skillKey - The skill identifier from SkillDefinition.key
   * @param input - Merged execution metadata + operator input
   * @param stepExecutionId - FK for artifact/llm_call persistence
   * @param complaintId - Direct FK from execution.complaintId (NOT from metadata)
   */
  async execute(
    skillKey: string,
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    try {
      switch (skillKey) {
        // === Wave 1: Data & Regulatory Skills ===
        case 'LoadComplaint':
          return await this.loadComplaint(input, stepExecutionId, complaintId);
        case 'NormalizeComplaintText':
          return await this.normalizeComplaintText(input, stepExecutionId, complaintId);
        case 'ComputeSla':
          return await this.computeSla(input, stepExecutionId, complaintId);
        case 'DetermineRegulatoryAction':
          return await this.determineRegulatoryAction(input, stepExecutionId, complaintId);
        case 'ValidateReclassification':
          return this.validateReclassification(input);
        case 'ValidateReencaminhamento':
          return this.validateReencaminhamento(input);
        case 'ValidateCancelamento':
          return this.validateCancelamento(input);

        // === Existing AI skills (Phase 4 — moved from TicketExecutionService) ===
        case 'ClassifyTypology': {
          const result = await this.complaintParser.classify(input);
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
          await this.artifactRepo.save(
            this.artifactRepo.create({
              complaintId,
              stepExecutionId,
              artifactType: 'typology_classification',
              content: result,
            }),
          );
          return result;
        }

        case 'RetrieveManualContext':
          return await this.retrieveManualContext(input, stepExecutionId, complaintId);

        case 'RetrieveIQITemplate':
          return await this.retrieveIQITemplate(input, stepExecutionId, complaintId);

        case 'BuildMandatoryChecklist':
          return await this.buildMandatoryChecklist(input, stepExecutionId, complaintId);

        case 'DraftFinalResponse': {
          const result = await this.draftGenerator.generate(input);
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
          // Persist ART-08 draft_response artifact
          const draftArtifact = await this.artifactRepo.save(
            this.artifactRepo.create({
              artifactType: 'draft_response',
              content: {
                draftResponse: result.draftResponse ?? result.text ?? '',
                templateUsed: result.templateUsed ?? null,
                mandatoryFieldsCount: result.mandatoryFieldsCount ?? 0,
                kbChunksUsed: result.kbChunksUsed ?? 0,
              },
              version: 1,
              stepExecutionId,
              complaintId,
            }),
          );
          return { ...result, artifactId: draftArtifact.id };
        }

        case 'ComplianceCheck': {
          const result = await this.complianceEvaluator.evaluate(input);
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
          // Persist ART-09 compliance_evaluation artifact
          const complianceArtifact = await this.artifactRepo.save(
            this.artifactRepo.create({
              artifactType: 'compliance_evaluation',
              content: {
                isCompliant: result.isCompliant ?? false,
                complianceScore: result.complianceScore ?? 0,
                violations: result.violations ?? [],
                mandatoryFieldsStatus: result.mandatoryFieldsStatus ?? [],
                recommendations: result.recommendations ?? [],
              },
              version: 1,
              stepExecutionId,
              complaintId,
            }),
          );
          return { ...result, artifactId: complianceArtifact.id };
        }

        case 'GenerateArtifact': {
          const result = await this.finalResponseComposer.compose(input);
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
          // Persist ART-10 final_response artifact
          const finalArtifact = await this.artifactRepo.save(
            this.artifactRepo.create({
              artifactType: 'final_response',
              content: {
                finalResponse: result.finalResponse ?? result.text ?? '',
                revisionsApplied: result.revisionsApplied ?? [],
              },
              version: 1,
              stepExecutionId,
              complaintId,
            }),
          );
          return { ...result, artifactId: finalArtifact.id };
        }

        // === Wave 2: Knowledge & Generation Skills ===
        case 'ApplyPersonaTone':
          return await this.applyPersonaTone(input, stepExecutionId, complaintId);

        // === Wave 3: Quality, Memory & Instrumentation Skills ===
        case 'HumanDiffCapture':
          return await this.humanDiffCapture(input, stepExecutionId, complaintId);
        case 'PersistMemory':
          return await this.persistMemory(input, stepExecutionId, complaintId);
        case 'TrackTokenUsage':
          return await this.trackTokenUsage(input);
        case 'AuditTrail':
          return await this.auditTrail(input, stepExecutionId, complaintId);

        default:
          return { error: 'Unknown skill: ' + skillKey, result: 'no_op' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Skill ${skillKey} failed: ${errorMessage}`);
      return {
        error: errorMessage,
        skillKey,
        failedAt: new Date().toISOString(),
      };
    }
  }

  // -----------------------------------------------------------------------
  // Wave 1 Skill Implementations
  // -----------------------------------------------------------------------

  /** SKLL-01: Load complaint with relations, persist ART-01 parsed_complaint */
  private async loadComplaint(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      relations: ['tipology', 'situation', 'subtipology'],
    });
    if (!complaint) return { error: 'Complaint not found', complaintId };

    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'parsed_complaint',
        content: {
          id: complaint.id,
          protocolNumber: complaint.protocolNumber,
          rawText: complaint.rawText,
          tipologyKey: complaint.tipology?.key ?? null,
          situationKey: complaint.situation?.key ?? null,
          source: complaint.source,
          externalId: complaint.externalId,
          status: complaint.status,
        },
        version: 1,
        stepExecutionId,
        complaintId: complaint.id,
      }),
    );

    return {
      complaint: { id: complaint.id, protocolNumber: complaint.protocolNumber },
      tipologyId: complaint.tipologyId,
      situationId: complaint.situationId,
      tipologyKey: complaint.tipology?.key ?? null,
      rawText: complaint.rawText,
      artifactId: artifact.id,
    };
  }

  /** SKLL-02: Normalize complaint text, persist ART-02 normalized_text */
  private async normalizeComplaintText(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const rawText = (input['rawText'] as string) ??
      (input['complaintText'] as string) ?? '';

    // Basic normalization: collapse whitespace, remove zero-width chars, trim
    const normalizedText = rawText
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width characters
      .replace(/\s+/g, ' ')                   // collapse multiple whitespace
      .trim();

    const changeCount = Math.abs(rawText.length - normalizedText.length);

    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'normalized_text',
        content: { originalText: rawText, normalizedText, changeCount },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return { normalizedText, changeCount, artifactId: artifact.id };
  }

  /**
   * SKLL-03: Read SLA from execution metadata (already computed in startExecution),
   * persist ART-03 sla_calculation artifact. Does NOT recompute.
   */
  private async computeSla(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const slaDeadline = input['slaDeadline'] as string ?? new Date().toISOString();
    const slaBusinessDays = (input['slaBusinessDays'] as number) ?? 10;
    const tipologyKey = input['tipologyKey'] as string ?? '';
    const situationKey = input['situationKey'] as string ?? null;

    // Compute isOverdue from deadline
    const isOverdue = new Date(slaDeadline) < new Date();

    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'sla_calculation',
        content: { slaDeadline, slaBusinessDays, isOverdue, tipologyKey, situationKey },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return { slaDeadline, slaBusinessDays, isOverdue, artifactId: artifact.id };
  }

  /**
   * SKLL-05: DetermineRegulatoryAction — uses generateObject to classify action.
   * Uses 'classificacao' functionalityType (light model, structured output).
   */
  private async determineRegulatoryAction(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const complaintText = (input['normalizedText'] as string) ??
      (input['rawText'] as string) ??
      (input['complaintText'] as string) ?? '';
    const tipologyKey = (input['tipologyKey'] as string) ?? 'desconhecida';
    const situationKey = (input['situationKey'] as string) ?? null;

    const result = await this.modelSelector.callWithFallback(
      'classificacao',
      async ({ model, config }) => {
        const startTime = Date.now();

        const systemPrompt = `Voce e um especialista em regulamentacao da Anatel e tratamento de reclamacoes de telecomunicacoes.
Analise a reclamacao e determine a acao regulatoria correta.

Regras:
- responder: Reclamacao valida que deve ser respondida normalmente
- reclassificar: Tipologia ou situacao classificada incorretamente, precisa reclassificacao
- reencaminhar: Reclamacao pertence a outra area ou operadora, deve ser reencaminhada
- cancelar: Reclamacao duplicada, sem fundamento, ou consumidor desistiu

Tipologia atual: ${tipologyKey}
Situacao atual: ${situationKey ?? 'nao informada'}`;

        const { object, usage } = await generateObject({
          model,
          schema: DetermineActionSchema,
          system: systemPrompt,
          prompt: `Reclamacao:\n${complaintText}`,
          temperature: config.temperature,
          maxTokens: config.maxTokens ?? 512,
        });
        const latencyMs = Date.now() - startTime;

        return {
          ...object,
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          },
          model: config.modelId,
          provider: config.provider,
          latencyMs,
        };
      },
    );

    // Track token usage
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

    // Persist regulatory_decision artifact (ART-04)
    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'regulatory_decision',
        content: {
          actionKey: result.actionKey,
          justification: result.justification,
          confidence: result.confidence,
        },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return {
      actionKey: result.actionKey,
      justification: result.justification,
      confidence: result.confidence,
      artifactId: artifact.id,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
    };
  }

  /** SKLL-06: ValidateReclassification — deterministic validation, no LLM */
  private validateReclassification(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const originalTipologyKey = input['originalTipologyKey'] as string;
    const newTipologyKey = input['newTipologyKey'] as string;
    const justification = input['justification'] as string;

    const errors: string[] = [];

    if (!originalTipologyKey) errors.push('originalTipologyKey obrigatorio');
    if (!newTipologyKey) errors.push('newTipologyKey obrigatorio');
    if (originalTipologyKey && newTipologyKey && originalTipologyKey === newTipologyKey) {
      errors.push('Nova tipologia deve ser diferente da original');
    }
    if (!justification || justification.trim().length < 10) {
      errors.push('Justificativa obrigatoria (minimo 10 caracteres) — conforme Manual Anatel Secao 6.1');
    }

    return { isValid: errors.length === 0, errors };
  }

  /** SKLL-07: ValidateReencaminhamento — deterministic validation, no LLM */
  private validateReencaminhamento(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const recipient = input['recipient'] as string;
    const justification = input['justification'] as string;

    const errors: string[] = [];

    if (!recipient || recipient.trim().length < 3) {
      errors.push('Destinatario obrigatorio (minimo 3 caracteres) — conforme Manual Anatel Secao 6.2');
    }
    if (!justification || justification.trim().length < 10) {
      errors.push('Justificativa obrigatoria (minimo 10 caracteres) — conforme Manual Anatel Secao 6.2');
    }

    return { isValid: errors.length === 0, errors };
  }

  /** SKLL-08: ValidateCancelamento — deterministic validation, no LLM */
  private validateCancelamento(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const reason = input['reason'] as string;
    const justification = input['justification'] as string;

    const errors: string[] = [];

    if (!reason || reason.trim().length < 5) {
      errors.push('Motivo de cancelamento obrigatorio (minimo 5 caracteres) — conforme Manual Anatel Secao 6.3');
    }
    if (!justification || justification.trim().length < 20) {
      errors.push('Justificativa detalhada obrigatoria (minimo 20 caracteres) — conforme Manual Anatel Secao 6.3');
    }

    return { isValid: errors.length === 0, errors };
  }

  // -----------------------------------------------------------------------
  // Existing AI Skills (moved from TicketExecutionService, now with artifact persistence)
  // -----------------------------------------------------------------------

  /** SKLL-09: RetrieveManualContext — vector search, persist ART-04 kb_context */
  private async retrieveManualContext(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const query = (input['complaintText'] as string) ??
      (input['normalizedText'] as string) ?? '';
    const chunks = await this.vectorSearch.search(query, 5, 'manual_anatel');

    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'kb_context',
        content: {
          chunks: chunks.map(c => ({ content: c.content, similarity: c.similarity })),
          query,
          totalChunks: chunks.length,
        },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return {
      chunks: chunks.map(c => ({ content: c.content, similarity: c.similarity })),
      artifactId: artifact.id,
    };
  }

  /** SKLL-10: RetrieveIQITemplate — template resolver, persist ART-05 iqi_template */
  private async retrieveIQITemplate(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const tipologyId = input['tipologyId'] as string | undefined;
    const situationId = (input['situationId'] as string) ?? null;
    if (!tipologyId) {
      return { templateContent: null, templateName: null, error: 'No tipologyId provided' };
    }
    const template = await this.templateResolver.resolve(tipologyId, situationId);

    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'iqi_template',
        content: {
          templateId: template?.id ?? null,
          templateName: template?.name ?? null,
          templateContent: template?.templateContent ?? null,
          matchType: template?.matchType ?? null,
        },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return {
      templateContent: template?.templateContent ?? null,
      templateName: template?.name ?? null,
      templateId: template?.id ?? null,
      matchType: template?.matchType ?? null,
      artifactId: artifact.id,
    };
  }

  /** SKLL-11: BuildMandatoryChecklist — mandatory info resolver, persist ART-06 mandatory_checklist */
  private async buildMandatoryChecklist(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const tipId = input['tipologyId'] as string | undefined;
    const sitId = (input['situationId'] as string) ?? null;
    if (!tipId) {
      return { checklist: [], completionPercentage: 0, error: 'No tipologyId provided' };
    }
    const fields = await this.mandatoryInfoResolver.resolve(tipId, sitId);

    const checklist = fields.map(f => ({
      fieldName: f.fieldName,
      fieldLabel: f.fieldLabel,
      isRequired: f.isRequired,
      isPresent: false, // checked by ComplianceCheck later
    }));

    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'mandatory_checklist',
        content: {
          checklist,
          completionPercentage: 0,
        },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return {
      checklist,
      completionPercentage: 0,
      artifactId: artifact.id,
    };
  }

  /**
   * SKLL-13: Apply persona tone to draft text.
   * Rule-based: loads Persona by tipologyId, enforces forbidden/required expressions.
   * No LLM call — pure string manipulation.
   */
  private async applyPersonaTone(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const draftText = (input['draftText'] as string) ??
      (input['draftResponse'] as string) ??
      (input['adjustedText'] as string) ?? '';
    const tipologyId = input['tipologyId'] as string | undefined;

    // If no tipologyId, return unchanged
    if (!tipologyId) {
      return { adjustedText: draftText, personaApplied: false, reason: 'No tipologyId provided' };
    }

    // Load active persona for this tipology
    const persona = await this.personaRepo.findOne({
      where: { tipologyId, isActive: true },
    });

    // If no persona found, return draft unchanged
    if (!persona) {
      return { adjustedText: draftText, personaApplied: false, reason: 'No active persona for tipology' };
    }

    let adjustedText = draftText;

    // Apply forbidden expressions (case-insensitive remove)
    for (const expr of persona.forbiddenExpressions ?? []) {
      adjustedText = adjustedText.replace(new RegExp(expr, 'gi'), '');
    }

    // Clean up any double spaces created by removal
    adjustedText = adjustedText.replace(/\s{2,}/g, ' ').trim();

    // Ensure required expressions are present (append if not found)
    for (const expr of persona.requiredExpressions ?? []) {
      if (!adjustedText.toLowerCase().includes(expr.toLowerCase())) {
        adjustedText += `\n${expr}`;
      }
    }

    return {
      adjustedText,
      personaApplied: true,
      personaId: persona.id,
      personaName: persona.name,
      formalityLevel: persona.formalityLevel,
      empathyLevel: persona.empathyLevel,
      assertivenessLevel: persona.assertivenessLevel,
    };
  }

  // -----------------------------------------------------------------------
  // Wave 3: Quality, Memory & Instrumentation Skills
  // -----------------------------------------------------------------------

  /**
   * SKLL-16: HumanDiffCapture — Phase 5 scaffold placeholder.
   * Persists ART-11 human_diff artifact with placeholder content.
   * Real diff computation happens in Phase 6 when human reviews and approves.
   */
  private async humanDiffCapture(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'human_diff',
        content: {
          diffSummary: 'pending_human_review',
          changesCount: null,
          aiDraft: (input['draftResponse'] as string) ?? (input['draftText'] as string) ?? null,
          humanFinal: null, // Populated in Phase 6 HITL
        },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return {
      diffSummary: 'pending_human_review',
      changesCount: null,
      artifactId: artifact.id,
    };
  }

  /**
   * SKLL-17: PersistMemory — creates CaseMemory row with pgvector embedding.
   * Uses ModelSelectorService.getEmbeddingModel() + embed() from 'ai' SDK.
   * Handles embedding failure gracefully with zero vector fallback.
   */
  private async persistMemory(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const stepOutputs = (input['stepOutputs'] as Record<string, Record<string, unknown>>) ?? {};
    const tipologyKey = (input['tipologyKey'] as string) ?? '';
    const actionKey = (input['selectedActionKey'] as string) ?? null;
    const tipologyId = (input['tipologyId'] as string) ?? null;

    // Build summary from available step outputs
    const finalResponse = (stepOutputs['GenerateArtifact']?.['finalResponse'] as string) ??
      (stepOutputs['DraftFinalResponse']?.['draftResponse'] as string) ?? '';
    const summaryText = `Reclamacao tipologia ${tipologyKey}, acao: ${actionKey ?? 'responder'}. ${finalResponse.slice(0, 300)}`;

    // Generate embedding
    let embeddingVector: number[];
    try {
      const embeddingModel = await this.modelSelector.getEmbeddingModel();
      const { embedding } = await embed({ model: embeddingModel, value: summaryText });
      embeddingVector = embedding;
    } catch (error) {
      // Fallback: zero vector (1536 dimensions) — allows row to be saved without embedding API
      this.logger.warn(`PersistMemory: embedding generation failed, using zero vector fallback. Error: ${error}`);
      embeddingVector = new Array(1536).fill(0);
    }

    // Save CaseMemory with embedding
    const caseMemory = this.caseMemoryRepo.create({
      summary: summaryText,
      decision: actionKey,
      outcome: actionKey,
      responseSnippet: finalResponse.slice(0, 500) || null,
      complaintId,
      tipologyId,
    });

    // Use raw query for pgvector insert (TypeORM cannot handle vector columns directly)
    const result = await this.dataSource.query(
      `INSERT INTO "case_memory" ("id", "summary", "decision", "outcome", "responseSnippet", "embedding", "complaintId", "tipologyId")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, $6, $7)
       RETURNING "id"`,
      [
        caseMemory.summary,
        caseMemory.decision,
        caseMemory.outcome,
        caseMemory.responseSnippet,
        pgvector.toSql(embeddingVector),
        complaintId,
        tipologyId,
      ],
    );

    const memoryId = result[0]?.id ?? null;

    return { memoryId };
  }

  /**
   * SKLL-18: TrackTokenUsage — aggregates existing llm_call rows for this execution.
   * Does NOT call TokenUsageTrackerService.track() — individual tracking already happened per-call.
   * Uses raw DataSource query for aggregation.
   */
  private async trackTokenUsage(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const ticketExecutionId = (input['ticketExecutionId'] as string) ??
      (input['executionId'] as string) ?? null;

    if (!ticketExecutionId) {
      return { totalTokens: 0, estimatedCostUsd: 0, error: 'No ticketExecutionId provided' };
    }

    const result = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(lc."totalTokens"), 0) AS total_tokens,
         COALESCE(SUM(lc."costUsd"), 0) AS total_cost_usd,
         COUNT(lc."id") AS total_calls
       FROM "llm_call" lc
       INNER JOIN "step_execution" se ON lc."stepExecutionId" = se."id"
       WHERE se."ticketExecutionId" = $1`,
      [ticketExecutionId],
    );

    return {
      totalTokens: Number(result[0]?.total_tokens ?? 0),
      estimatedCostUsd: Number(result[0]?.total_cost_usd ?? 0),
      totalLlmCalls: Number(result[0]?.total_calls ?? 0),
    };
  }

  /**
   * SKLL-19: AuditTrail — creates append-only AuditLog entry with full execution snapshot.
   * Persists ART-10 audit_trail artifact.
   * AuditLog has no updatedAt (append-only by design).
   */
  private async auditTrail(
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> {
    const ticketExecutionId = (input['ticketExecutionId'] as string) ??
      (input['executionId'] as string) ?? null;

    const log = await this.auditLogRepo.save(
      this.auditLogRepo.create({
        action: 'skill_audit_trail',
        entityType: 'ticket_execution',
        entityId: ticketExecutionId ?? complaintId,
        details: {
          complaintId,
          stepOutputs: input['stepOutputs'] ?? {},
          tipologyKey: input['tipologyKey'] ?? null,
          selectedActionKey: input['selectedActionKey'] ?? null,
          slaDeadline: input['slaDeadline'] ?? null,
          situationKey: input['situationKey'] ?? null,
        },
      }),
    );

    // Persist ART-10 audit_trail artifact
    const artifact = await this.artifactRepo.save(
      this.artifactRepo.create({
        artifactType: 'audit_trail',
        content: {
          auditLogId: log.id,
          action: 'skill_audit_trail',
          entityType: 'ticket_execution',
          entityId: ticketExecutionId ?? complaintId,
          details: log.details,
        },
        version: 1,
        stepExecutionId,
        complaintId,
      }),
    );

    return { auditLogId: log.id, artifactId: artifact.id };
  }
}
