import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { generateText } from 'ai';
import { ModelSelectorService } from './model-selector.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';
import { TemplateResolverService } from '../../base-de-conhecimento/services/template-resolver.service';
import { MandatoryInfoResolverService } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';
import { Persona } from '../../regulatorio/entities/persona.entity';

const FORMALITY_LABEL: Record<number, string> = {
  1: 'muito informal', 2: 'informal', 3: 'neutro', 4: 'formal', 5: 'muito formal',
};
const LEVEL_LABEL: Record<number, string> = {
  1: 'baixíssima', 2: 'baixa', 3: 'média', 4: 'alta', 5: 'altíssima',
};

@Injectable()
export class DraftGeneratorAgent {
  private readonly logger = new Logger(DraftGeneratorAgent.name);

  constructor(
    private readonly modelSelector: ModelSelectorService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly vectorSearch: VectorSearchService,
    private readonly templateResolver: TemplateResolverService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
  ) {}

  /** Resolves the active persona for the given tipology, falling back to the
   *  global (tipologyId IS NULL) persona when no tipology-specific one exists. */
  private async resolvePersona(tipologyId?: string | null): Promise<Persona | null> {
    if (tipologyId) {
      const specific = await this.personaRepo.findOne({
        where: { tipologyId, isActive: true },
      });
      if (specific) return specific;
    }
    return this.personaRepo.findOne({
      where: { tipologyId: IsNull(), isActive: true },
    });
  }

  /** Builds the persona instruction block fed into PromptBuilder. Mirrors
   *  smart-note's buildPersonaSuffix so both flows steer the LLM identically. */
  private buildPersonaInstructionBlock(persona: Persona): string {
    const lines: string[] = [
      `--- Diretrizes da persona "${persona.name}" ---`,
    ];
    if (persona.instructions && persona.instructions.trim().length > 0) {
      lines.push(persona.instructions.trim());
    }
    if (persona.requiredExpressions && persona.requiredExpressions.length > 0) {
      lines.push(`Inclua naturalmente estas expressões: ${persona.requiredExpressions.join(', ')}.`);
    }
    if (persona.forbiddenExpressions && persona.forbiddenExpressions.length > 0) {
      lines.push(`Não use, em hipótese nenhuma, estas palavras/expressões: ${persona.forbiddenExpressions.join(', ')}.`);
    }
    return lines.join('\n');
  }

  /**
   * Generates a draft response for a complaint.
   * Uses the 'composicao' model config. Temperature MUST stay low (~0.2) —
   * this is regulatory writing, "creativity" here means hallucinating dates,
   * prazos, phone numbers and ações tomadas. Raise knowingly only.
   */
  async generate(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const complaintText = (input['complaintText'] as string) ??
      (input['normalizedText'] as string) ??
      '';
    const tipologyKey = (input['tipologyKey'] as string) ?? 'desconhecida';
    const tipologyId = input['tipologyId'] as string | undefined;
    const situationKey = input['situationKey'] as string | null ?? null;
    const situationId = input['situationId'] as string | null ?? null;
    // Support both top-level and nested (legacy) formats
    const complaintNested = input['complaint'] as Record<string, unknown> | undefined;
    const protocolNumber = (input['protocolNumber'] as string | undefined)
      ?? (complaintNested?.['protocolNumber'] as string | undefined);
    const protocoloPrestadora = input['protocoloPrestadora'] as string | null | undefined;
    const consumerName = input['consumerName'] as string | undefined;
    const consumerCpf = input['consumerCpf'] as string | null | undefined;
    const slaDeadline = input['slaDeadline'] as string | undefined;
    const slaBusinessDays = input['slaBusinessDays'] as number | undefined;
    const previousStepOutputs = input['stepOutputs'] as Record<string, Record<string, unknown>> | undefined;
    const complaintId = (input['complaintId'] as string | undefined)
      ?? (complaintNested?.['id'] as string | undefined)
      ?? null;

    // 1. Retrieve KB context
    const kbChunks = await this.vectorSearch.search(complaintText, 5);

    // 2. Resolve template — passes complaintId so the operator-forced template
    //    override (set via POST /api/complaints/:id/override-template) takes
    //    precedence over the IA's tipology-based match.
    const template = tipologyId
      ? await this.templateResolver.resolve(tipologyId, situationId, complaintId)
      : null;

    // 3. Resolve mandatory fields
    const mandatoryFields = tipologyId
      ? await this.mandatoryInfoResolver.resolve(tipologyId, situationId)
      : [];

    // 4. Build prompt — include memory-augmented context if passed in
    const similarCases = input['similarCases'] as Array<{ metadata: Record<string, unknown>; similarity: number }> | undefined;
    const humanCorrections = input['humanCorrections'] as Array<{ aiText: string; humanText: string; diffDescription: string; similarity: number }> | undefined;
    const humanRejections = input['humanRejections'] as Array<{ aiText: string; rejectionReason: string; similarity: number | null }> | undefined;
    const stylePatterns = input['stylePatterns'] as Array<{ expression: string; type: 'approved' | 'forbidden' }> | undefined;

    // Persona steering — tipology-specific persona wins, falls back to global.
    // Feeds the LLM the admin-configured tone + instruction brief so the draft
    // already complies with what `/api/ai/persona-check` will validate later.
    const persona = await this.resolvePersona(tipologyId);
    const personaTone = persona
      ? `formalidade=${FORMALITY_LABEL[persona.formalityLevel] ?? persona.formalityLevel}, empatia=${LEVEL_LABEL[persona.empathyLevel] ?? persona.empathyLevel}, assertividade=${LEVEL_LABEL[persona.assertivenessLevel] ?? persona.assertivenessLevel}`
      : undefined;
    const personaInstructions = persona ? this.buildPersonaInstructionBlock(persona) : undefined;

    const ctx: PromptContext = {
      complaintText,
      tipologyKey,
      situationKey,
      protocolNumber,
      protocoloPrestadora,
      consumerName,
      consumerCpf,
      slaDeadline,
      slaBusinessDays,
      analysisDate: new Date().toLocaleDateString('pt-BR'),
      kbChunks,
      template,
      mandatoryFields,
      personaTone,
      personaInstructions,
      previousStepOutputs,
      similarCases,
      humanCorrections,
      humanRejections,
      stylePatterns,
      // PIPE-03: forward operator note from LoadComplaint skill output into prompt context
      operatorNote: (input['operatorNote'] as string | null) ?? null,
      operatorNoteParameters: (input['operatorNoteParameters'] as Record<string, unknown> | null) ?? null,
    };

    const customSystemPrompt = input['customSystemPrompt'] as string | undefined;
    const { system, user } = this.promptBuilder.buildDraftResponsePrompt(ctx, customSystemPrompt);

    // 5. Call LLM with fallback
    const result = await this.modelSelector.callWithFallback(
      'composicao',
      async ({ model, config }) => {
        const startTime = Date.now();
        const { text, usage } = await generateText({
          model,
          system,
          prompt: user,
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens ?? 4096,
        });
        const latencyMs = Date.now() - startTime;

        this.logger.log(`Draft generated in ${latencyMs}ms — ${text.length} chars`);

        return {
          draftResponse: text,
          templateUsed: template
            ? { id: template.id, name: template.name, matchType: template.matchType }
            : null,
          mandatoryFieldsCount: mandatoryFields.length,
          kbChunksUsed: kbChunks.length,
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

    return result;
  }
}
