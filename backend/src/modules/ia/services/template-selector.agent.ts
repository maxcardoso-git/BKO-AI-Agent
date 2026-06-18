import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ModelSelectorService } from './model-selector.service';

export interface TemplateCandidate {
  id: string;
  name: string;
  content: string;
}

export interface TemplateSelection {
  templateId: string;
  confidence: number;
  reasoning: string;
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;
  provider?: string;
  latencyMs?: number;
}

// Guardrails for prompt size — a tipology can legitimately have dozens of
// templates (Cobrança has ~61). Names + short snippets keep the call cheap.
const MAX_CANDIDATES = 120;
const SNIPPET_LEN = 220;

/**
 * Picks the single most adequate IQI response template for a complaint, among
 * the active templates of its tipology.
 *
 * Why this exists: IQI templates are differentiated only by their name/content
 * (the regulatory "assunto"), not by any structured key — `situationId` is the
 * complaint lifecycle state (Aberta/Vencida...), not the IQI category, and is
 * NULL on every template. So the deterministic resolver collapses all of a
 * tipology's templates onto the same key and tie-breaks by `version` (i.e.
 * "most edited wins"), which is effectively random. This agent reads the
 * complaint and chooses by meaning instead. Returns null on any failure so the
 * caller can fall back to the deterministic resolver.
 */
@Injectable()
export class TemplateSelectorAgent {
  private readonly logger = new Logger(TemplateSelectorAgent.name);

  constructor(private readonly modelSelector: ModelSelectorService) {}

  async select(
    complaintText: string,
    candidates: TemplateCandidate[],
  ): Promise<TemplateSelection | null> {
    if (!candidates.length) return null;

    const list = candidates.slice(0, MAX_CANDIDATES);
    if (candidates.length > MAX_CANDIDATES) {
      this.logger.warn(
        `TemplateSelector: ${candidates.length} candidates exceed cap, truncated to ${MAX_CANDIDATES}`,
      );
    }

    const schema = z.object({
      choice: z
        .number()
        .int()
        .describe('Numero (1-based) do template mais adequado da lista.'),
      confidence: z.number().min(0).max(1).describe('Confianca de 0 a 1 na escolha.'),
      reasoning: z.string().describe('Justificativa curta (1 frase) da escolha.'),
    });

    const system = [
      'Voce e um analista de back-office regulatorio de telecom (respostas ANATEL).',
      'Tarefa: dada a reclamacao do consumidor e uma lista numerada de templates de',
      'resposta IQI, escolher O UNICO template mais adequado para responder a esta',
      'reclamacao.',
      '',
      'REGRAS:',
      '- Retorne em "choice" SOMENTE um numero presente na lista.',
      '- Decida pelo ASSUNTO da reclamacao versus o nome/conteudo de cada template.',
      '- Se varios parecerem aplicaveis, escolha o MAIS ESPECIFICO ao caso descrito.',
      '- Se nenhum for claramente adequado, escolha o menos inadequado com confidence baixa.',
    ].join('\n');

    const user = [
      '## Templates disponiveis (escolha 1 pelo numero):',
      ...list.map(
        (c, i) =>
          `${i + 1}. ${c.name}\n   ${(c.content ?? '').replace(/\s+/g, ' ').slice(0, SNIPPET_LEN)}`,
      ),
      '',
      '## Reclamacao do consumidor:',
      complaintText.trim().slice(0, 6000) || '(texto vazio)',
    ].join('\n');

    try {
      const r = await this.modelSelector.callWithFallback(
        'classificacao',
        async ({ model, config }) => {
          const start = Date.now();
          const { object, usage } = await generateObject({
            model,
            schema,
            system,
            prompt: user,
            temperature: 0.1,
            maxOutputTokens: config.maxOutputTokens ?? 512,
          });
          return {
            object,
            usage,
            model: config.modelId,
            provider: config.provider,
            latencyMs: Date.now() - start,
          };
        },
      );

      const idx = Math.round(r.object.choice) - 1;
      if (idx < 0 || idx >= list.length) {
        this.logger.warn(
          `TemplateSelector: choice ${r.object.choice} out of range (1..${list.length})`,
        );
        return null;
      }

      this.logger.log(
        `Template selected #${idx + 1}/${list.length} (conf=${r.object.confidence}) in ${r.latencyMs}ms (${r.provider}/${r.model})`,
      );

      return {
        templateId: list[idx].id,
        confidence: r.object.confidence,
        reasoning: r.object.reasoning,
        usage: {
          inputTokens: r.usage.inputTokens ?? 0,
          outputTokens: r.usage.outputTokens ?? 0,
        },
        model: r.model,
        provider: r.provider,
        latencyMs: r.latencyMs,
      };
    } catch (err) {
      this.logger.warn(`Template selection failed: ${(err as Error).message}`);
      return null;
    }
  }
}
