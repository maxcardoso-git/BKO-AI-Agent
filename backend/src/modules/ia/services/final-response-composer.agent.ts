import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { ModelSelectorService } from './model-selector.service';

@Injectable()
export class FinalResponseComposerAgent {
  private readonly logger = new Logger(FinalResponseComposerAgent.name);

  constructor(
    private readonly modelSelector: ModelSelectorService,
  ) {}

  /**
   * Consolidates the final response from a draft + compliance evaluation feedback.
   * Applies corrections from compliance violations and recommendations.
   * Uses 'composicao' model config.
   */
  async compose(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const draftResponse = (input['draftResponse'] as string) ?? '';
    const violations = (input['violations'] as Array<{ rule: string; description: string; suggestion: string }>) ?? [];
    const recommendations = (input['recommendations'] as string[]) ?? [];
    const complaintText = (input['complaintText'] as string) ?? '';
    const tipologyKey = (input['tipologyKey'] as string) ?? '';
    const consumerName = (input['consumerName'] as string) ?? '';

    // If no violations and no recommendations, the draft is the final response
    if (violations.length === 0 && recommendations.length === 0) {
      return {
        finalResponse: draftResponse,
        revisionsApplied: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        model: 'none',
        provider: 'none',
      };
    }

    const system = [
      'Voce e um redator especializado em respostas regulatorias da Anatel.',
      'Sua tarefa e revisar a resposta rascunho aplicando as correcoes indicadas pela avaliacao de conformidade.',
      '',
      'Regras:',
      '- Mantenha o conteudo factual do rascunho original',
      '- Aplique TODAS as correcoes indicadas nas violacoes',
      '- Incorpore as recomendacoes de melhoria',
      '- Mantenha o tom profissional e objetivo',
      '- NAO invente informacoes que nao estejam no rascunho original ou na reclamacao',
    ].join('\n');

    const userParts = [
      '## Rascunho original:',
      draftResponse,
      '',
    ];

    if (violations.length > 0) {
      userParts.push('## Violacoes a corrigir:');
      for (const v of violations) {
        userParts.push(`- [${v.rule}] ${v.description} — Sugestao: ${v.suggestion}`);
      }
      userParts.push('');
    }

    if (recommendations.length > 0) {
      userParts.push('## Recomendacoes:');
      for (const r of recommendations) {
        userParts.push(`- ${r}`);
      }
      userParts.push('');
    }

    userParts.push(
      '## Dados de referencia:',
      `Tipologia: ${tipologyKey}`,
      `Consumidor: ${consumerName || 'N/A'}`,
      '',
      'Reescreva a resposta aplicando todas as correcoes. Retorne APENAS a resposta final revisada.',
    );

    // Suppress unused variable warning — complaintText available for future prompt enrichment
    void complaintText;

    const user = userParts.join('\n');

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

        this.logger.log(`Final response composed in ${latencyMs}ms — ${text.length} chars`);

        return {
          finalResponse: text,
          revisionsApplied: violations.length + recommendations.length,
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
