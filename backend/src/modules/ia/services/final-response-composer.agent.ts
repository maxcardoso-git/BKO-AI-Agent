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
      '## REGRAS ABSOLUTAS (precedem qualquer outra instrução)',
      '',
      'Esta é uma resposta REGULATÓRIA da Anatel. Errar fato vira multa.',
      '',
      '1. NUNCA invente: datas, valores, prazos, telefones, números de protocolo, ações tomadas, status de cobrança, prazos de estorno, números de ouvidoria, endereços, planos, serviços.',
      '2. Use APENAS dados que JÁ ESTEJAM no rascunho original ou na reclamação do consumidor.',
      '3. Se uma violação pedir um dado ausente, NÃO invente — escreva "[dado pendente]" ou deixe a frase que cita o dado fora da resposta.',
      '4. Telefones, 0800, ouvidoria: NÃO mencione nenhum se já não estiver no rascunho original.',
      '5. Prazos (estorno, devolução, reativação): NÃO use defaults como "5 a 10 dias úteis" se não estiverem no rascunho.',
      '',
      'Você é um redator regulatório da Anatel revisando o rascunho.',
      'Aplique as correções de conformidade indicadas, MAS sem inventar.',
      '',
      'Diretrizes:',
      '- Mantenha o conteúdo factual do rascunho original',
      '- Aplique as correções indicadas APENAS quando os dados necessários já constarem do rascunho ou da reclamação',
      '- Quando a correção exigir um dado que não está disponível, deixe a parte em "[dado pendente]" — NUNCA chute',
      '- Mantenha tom profissional e objetivo',
      '- Sem invenção, sem default genérico',
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
