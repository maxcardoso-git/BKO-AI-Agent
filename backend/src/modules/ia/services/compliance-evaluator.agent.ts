import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ModelSelectorService } from './model-selector.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';
import { MandatoryInfoResolverService } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';

const ComplianceEvaluationSchema = z.object({
  isCompliant: z.boolean().describe('Se a resposta esta em conformidade regulatoria geral'),
  complianceScore: z.number().min(0).max(1).describe('Score de conformidade de 0 a 1'),
  violations: z.array(
    z.object({
      rule: z.string().describe('Regra ou item regulatorio violado'),
      severity: z.enum(['info', 'warning', 'error', 'critical']).describe('Severidade da violacao'),
      description: z.string().describe('Descricao da violacao'),
      suggestion: z.string().describe('Sugestao de correcao'),
    }),
  ).describe('Lista de violacoes encontradas'),
  mandatoryFieldsStatus: z.array(
    z.object({
      fieldName: z.string(),
      fieldLabel: z.string(),
      isPresent: z.boolean().describe('Se o item obrigatorio esta presente na resposta'),
      excerpt: z.string().nullable().describe('Trecho da resposta onde o item foi encontrado'),
    }),
  ).describe('Status de cada item obrigatorio'),
  recommendations: z.array(z.string()).describe('Recomendacoes para melhorar a conformidade'),
  languageQuality: z.object({
    isAppropriate: z.boolean(),
    issues: z.array(z.string()).describe('Problemas de linguagem identificados'),
  }).describe('Avaliacao da qualidade da linguagem'),
});

export type ComplianceEvaluationResult = z.infer<typeof ComplianceEvaluationSchema>;

@Injectable()
export class ComplianceEvaluatorAgent {
  private readonly logger = new Logger(ComplianceEvaluatorAgent.name);

  constructor(
    private readonly modelSelector: ModelSelectorService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly vectorSearch: VectorSearchService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
  ) {}

  /**
   * Evaluates a draft response for regulatory compliance.
   * Uses 'avaliacao' model config (medium model, low temperature for consistency).
   */
  async evaluate(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const draftResponse = (input['draftResponse'] as string) ?? '';
    const complaintText = (input['complaintText'] as string) ??
      (input['normalizedText'] as string) ?? '';
    const tipologyKey = (input['tipologyKey'] as string) ?? 'desconhecida';
    const tipologyId = input['tipologyId'] as string | undefined;
    const situationKey = input['situationKey'] as string | null ?? null;
    const situationId = input['situationId'] as string | null ?? null;

    // 1. Retrieve regulatory context
    const kbChunks = await this.vectorSearch.search(
      `conformidade regulatoria ${tipologyKey} resposta anatel`,
      5,
      'manual_anatel',
    );

    // 2. Resolve mandatory fields
    const mandatoryFields = tipologyId
      ? await this.mandatoryInfoResolver.resolve(tipologyId, situationId)
      : [];

    // 3. Build prompt
    const ctx: PromptContext & { draftResponse: string } = {
      complaintText,
      tipologyKey,
      situationKey,
      kbChunks,
      mandatoryFields,
      draftResponse,
    };

    const { system, user } = this.promptBuilder.buildCompliancePrompt(ctx);

    // 4. Call LLM with fallback
    const result = await this.modelSelector.callWithFallback(
      'avaliacao',
      async ({ model, config }) => {
        const startTime = Date.now();
        const { object, usage } = await generateObject({
          model,
          schema: ComplianceEvaluationSchema,
          system,
          prompt: user,
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens ?? 2048,
        });
        const latencyMs = Date.now() - startTime;

        this.logger.log(
          `Compliance evaluated in ${latencyMs}ms — compliant: ${object.isCompliant}, score: ${object.complianceScore}`,
        );

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

    return result;
  }
}
