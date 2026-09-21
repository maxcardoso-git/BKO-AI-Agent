import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ModelSelectorService } from './model-selector.service';

export interface MandatoryFieldRule {
  fieldName: string;
  fieldLabel: string;
  fieldDescription?: string | null;
}

export interface ExtractedField {
  fieldName: string;
  fieldLabel: string;
  /** Suggested value drawn from the complaint text. Empty string when the
   *  rule's information is not present in the source — the operator fills
   *  it in by hand. */
  suggestedValue: string;
  /** True when the LLM judged the source text had enough signal to fill it. */
  hasSignal: boolean;
}

/**
 * Reads the consumer complaint text AND the operator note, and produces best-effort suggested values
 * for the mandatory ANATEL response fields (Descricao do Fato, Providencia
 * Adotada, Data de Resolucao, etc.). The operator reviews and edits before
 * the main IA pipeline runs.
 *
 * Strict contract: NEVER invent dates, protocol numbers, or values not
 * present in the text. When the source is silent, return an empty value
 * with hasSignal=false so the operator knows it needs manual input.
 */
@Injectable()
export class MandatoryFieldExtractorAgent {
  private readonly logger = new Logger(MandatoryFieldExtractorAgent.name);

  constructor(private readonly modelSelector: ModelSelectorService) {}

  async extract(
    complaintText: string,
    rules: MandatoryFieldRule[],
    /**
     * A NOTA DO OPERADOR — a palavra da PRESTADORA sobre o caso.
     *
     * Faltava aqui, e era o buraco central: a extração lia só a reclamação do consumidor. Tudo
     * o que prova que a prestadora agiu — tentativas de contato com data, hora e telefone,
     * e-mail de posicionamento enviado, protocolo de atendimento, plano, valores creditados —
     * está na NOTA, não na reclamação. Sem ela, os campos obrigatórios voltavam vazios e a
     * resposta saía sem os fatos que a Anatel avalia.
     */
    operatorNote?: string | null,
  ): Promise<ExtractedField[]> {
    if (!rules.length) return [];

    // Build a dynamic Zod schema with one nullable string per rule. The LLM
    // is forced to produce a value (possibly empty) for every requested field
    // — no skipping, no extras.
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const rule of rules) {
      shape[rule.fieldName] = z.object({
        value: z.string().describe(
          `Valor extraido para "${rule.fieldLabel}". String vazia se a informacao nao estiver presente no texto.`,
        ),
        hasSignal: z.boolean().describe(
          'true se o texto fornece informacao suficiente para preencher este campo; false caso contrario.',
        ),
      });
    }
    const schema = z.object(shape);

    const system = [
      'Voce e um analista de back-office da operadora de telecom.',
      'Sua tarefa: ler a reclamacao do consumidor e, para cada campo obrigatorio listado, extrair o que ja consta no texto.',
      '',
      'REGRAS RIGIDAS:',
      '- NUNCA invente datas, valores monetarios, protocolos ou numeros que nao estejam explicitos no texto.',
      '- Quando o texto nao tiver a informacao do campo, retorne value="" e hasSignal=false. Nao chute.',
      '- Quando o texto tiver a informacao, retorne value preenchido com a frase mais concisa e factual possivel (1-2 sentencas, em portugues do Brasil).',
      '- Para "Descricao do Fato": resuma objetivamente o que aconteceu, na voz do operador (ex.: "Cliente teve linha suspensa apos pagamento da fatura de maio.").',
      '- Para "Providencia Adotada": descreva a acao que sera tomada para resolver o problema. Se o texto nao disser, retorne hasSignal=false.',
      '- Para "Data de Resolucao": use formato DD/MM/AAAA. Se o texto nao trouxer uma data explicita de resolucao, hasSignal=false.',
      '- Para campos como CPF, Numero do Protocolo, Nome do Reclamante: extraia exatamente como aparecem.',
      '',
      'DUAS FONTES, PESOS DIFERENTES:',
      '- A RECLAMACAO e a versao do consumidor: use para o que ele alega, pediu e relatou.',
      '- A NOTA DO OPERADOR e a apuracao da PRESTADORA: ela manda no que a empresa fez, constatou',
      '  e vai fazer. Havendo divergencia sobre uma acao da empresa, vale a nota.',
      '- Um campo pode ser preenchido a partir de QUALQUER uma das duas. Nao devolva vazio um',
      '  campo cuja resposta esta na nota so porque ela nao esta na reclamacao.',
      '',
      'O QUE A NOTA COSTUMA TRAZER E NAO PODE SE PERDER (copie como esta escrito):',
      '- tentativas de contato: QUANTAS, em que DATA e HORARIO, para qual TELEFONE, e se houve ou',
      '  nao sucesso (tentativa sem exito tambem e acao da prestadora e precisa ser registrada);',
      '- envio de posicionamento: por qual CANAL (e-mail, carta, SMS, WhatsApp), para qual',
      '  ENDERECO/numero e em que DATA;',
      '- protocolos de atendimento e de ouvidoria, com a data de registro;',
      '- o que foi constatado no sistema (plano contratado, consumo, status da linha);',
      '- valores creditados, estornados ou disponibilizados, e a data.',
      '',
      'Retorne apenas o objeto JSON, sem comentarios.',
    ].join('\n');

    const user = [
      '## Campos obrigatorios para extrair:',
      ...rules.map(
        (r) =>
          `- ${r.fieldName} ("${r.fieldLabel}")${r.fieldDescription ? ` — ${r.fieldDescription}` : ''}`,
      ),
      '',
      '## Reclamacao do consumidor:',
      complaintText.trim() || '(texto vazio)',
      '',
      '## Nota do operador (apuracao da prestadora):',
      (operatorNote ?? '').trim() || '(sem nota registrada)',
    ].join('\n');

    try {
      const result = await this.modelSelector.callWithFallback(
        'classificacao',
        async ({ model, config }) => {
          const startTime = Date.now();
          const { object, usage } = await generateObject({
            model,
            schema,
            system,
            prompt: user,
            temperature: 0.1,
            maxOutputTokens: config.maxOutputTokens ?? 1024,
          });
          const latencyMs = Date.now() - startTime;
          this.logger.log(
            `Extracted ${rules.length} mandatory fields in ${latencyMs}ms (${config.provider}/${config.modelId}, in=${usage.inputTokens ?? 0} out=${usage.outputTokens ?? 0})`,
          );
          return object;
        },
      );

      const out: ExtractedField[] = rules.map((rule) => {
        const entry = (result as Record<string, { value: string; hasSignal: boolean } | undefined>)[rule.fieldName];
        return {
          fieldName: rule.fieldName,
          fieldLabel: rule.fieldLabel,
          suggestedValue: (entry?.value ?? '').trim(),
          hasSignal: !!entry?.hasSignal,
        };
      });
      return out;
    } catch (err) {
      // Extraction is best-effort UX sugar — if the model fails, return empty
      // suggestions so the operator just sees the existing empty form.
      this.logger.warn(`Mandatory field extraction failed: ${(err as Error).message}`);
      return rules.map((rule) => ({
        fieldName: rule.fieldName,
        fieldLabel: rule.fieldLabel,
        suggestedValue: '',
        hasSignal: false,
      }));
    }
  }
}
