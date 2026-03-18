import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ModelSelectorService } from './model-selector.service';
import { PromptBuilderService, PromptContext } from './prompt-builder.service';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';

// Zod schema for structured complaint parsing output
const ComplaintParseSchema = z.object({
  tipologyKey: z.string().describe('Chave da tipologia identificada (cobranca, portabilidade, qualidade, cancelamento, etc.)'),
  subtipologyKey: z.string().nullable().describe('Chave da subtipologia, se identificada'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianca da classificacao (0-1)'),
  summary: z.string().describe('Resumo conciso da reclamacao em 2-3 frases'),
  keyFacts: z.array(z.string()).describe('Lista de fatos-chave extraidos da reclamacao'),
  consumerIntent: z.string().describe('O que o consumidor deseja como resolucao'),
  urgencyLevel: z.enum(['baixo', 'medio', 'alto', 'critico']).describe('Nivel de urgencia baseado no conteudo'),
  mentionedValues: z.object({
    monetaryAmount: z.number().nullable().describe('Valor monetario mencionado, se houver'),
    dates: z.array(z.string()).describe('Datas mencionadas na reclamacao'),
    protocolNumbers: z.array(z.string()).describe('Numeros de protocolo anteriores mencionados'),
  }).describe('Valores especificos extraidos do texto'),
});

export type ComplaintParseResult = z.infer<typeof ComplaintParseSchema>;

@Injectable()
export class ComplaintParsingAgent {
  private readonly logger = new Logger(ComplaintParsingAgent.name);

  constructor(
    private readonly modelSelector: ModelSelectorService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  /**
   * Parses a complaint text into structured data using an LLM with generateObject.
   * Uses the 'classificacao' model config (lighter model, low temperature).
   */
  async parse(input: {
    complaintText: string;
    tipologyKey?: string;
    protocolNumber?: string;
  }): Promise<ComplaintParseResult & { usage: { inputTokens: number; outputTokens: number }; model: string; provider: string }> {
    // 1. Retrieve relevant KB context
    const kbChunks = await this.vectorSearch.search(
      input.complaintText,
      3,
      'manual_anatel',
    );

    // 2. Build prompt
    const ctx: PromptContext = {
      complaintText: input.complaintText,
      tipologyKey: input.tipologyKey ?? 'desconhecida',
      protocolNumber: input.protocolNumber,
      kbChunks,
    };

    const { system, user } = this.promptBuilder.buildClassificationPrompt(ctx);

    // 3. Call LLM with fallback
    const result = await this.modelSelector.callWithFallback(
      'classificacao',
      async ({ model, config }) => {
        const startTime = Date.now();
        const { object, usage } = await generateObject({
          model,
          schema: ComplaintParseSchema,
          system,
          prompt: user,
          temperature: config.temperature,
          maxTokens: config.maxTokens ?? 1024,
        });
        const latencyMs = Date.now() - startTime;

        this.logger.log(
          `Complaint parsed in ${latencyMs}ms — tipology: ${object.tipologyKey}, confidence: ${object.confidence}`,
        );

        return {
          ...object,
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          },
          model: config.modelId,
          provider: config.provider,
        };
      },
    );

    return result;
  }

  /**
   * Classify method — alias for parse(), used by the skill router in TicketExecutionService.
   * Input/output shaped for the skill dispatch interface.
   */
  async classify(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const complaintText = (input['complaintText'] as string) ??
      (input['normalizedText'] as string) ??
      '';
    const tipologyKey = input['tipologyKey'] as string | undefined;
    const protocolNumber = input['protocolNumber'] as string | undefined;

    const result = await this.parse({ complaintText, tipologyKey, protocolNumber });

    return {
      tipologyKey: result.tipologyKey,
      subtipologyKey: result.subtipologyKey,
      confidence: result.confidence,
      summary: result.summary,
      keyFacts: result.keyFacts,
      consumerIntent: result.consumerIntent,
      urgencyLevel: result.urgencyLevel,
      mentionedValues: result.mentionedValues,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
    };
  }
}
