import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { ModelSelectorService } from './model-selector.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';
import { TemplateResolverService } from '../../base-de-conhecimento/services/template-resolver.service';
import { MandatoryInfoResolverService } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';

@Injectable()
export class DraftGeneratorAgent {
  private readonly logger = new Logger(DraftGeneratorAgent.name);

  constructor(
    private readonly modelSelector: ModelSelectorService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly vectorSearch: VectorSearchService,
    private readonly templateResolver: TemplateResolverService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
  ) {}

  /**
   * Generates a draft response for a complaint.
   * Uses the 'composicao' model config (heavier model, higher temperature for creativity).
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

    // 1. Retrieve KB context
    const kbChunks = await this.vectorSearch.search(complaintText, 5);

    // 2. Resolve template
    const template = tipologyId
      ? await this.templateResolver.resolve(tipologyId, situationId)
      : null;

    // 3. Resolve mandatory fields
    const mandatoryFields = tipologyId
      ? await this.mandatoryInfoResolver.resolve(tipologyId, situationId)
      : [];

    // 4. Build prompt — include memory-augmented context if passed in
    const similarCases = input['similarCases'] as Array<{ metadata: Record<string, unknown>; similarity: number }> | undefined;
    const humanCorrections = input['humanCorrections'] as Array<{ aiText: string; humanText: string; diffDescription: string; similarity: number }> | undefined;
    const stylePatterns = input['stylePatterns'] as Array<{ expression: string; type: 'approved' | 'forbidden' }> | undefined;

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
      previousStepOutputs,
      similarCases,
      humanCorrections,
      stylePatterns,
    };

    const { system, user } = this.promptBuilder.buildDraftResponsePrompt(ctx);

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
