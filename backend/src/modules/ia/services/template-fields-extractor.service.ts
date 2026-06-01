import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateText } from 'ai';
import { Complaint } from '../../operacao/entities/complaint.entity';
import { ResponseTemplate } from '../../regulatorio/entities/response-template.entity';
import { TemplateResolverService } from '../../base-de-conhecimento/services/template-resolver.service';
import { MandatoryInfoResolverService } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';
import { ModelSelectorService } from './model-selector.service';

export type TemplateFieldType = 'date' | 'number' | 'text';
export type TemplateFieldSource = 'anatel' | 'template';

export interface TemplateField {
  key: string;
  label: string;
  type: TemplateFieldType;
  source: TemplateFieldSource;
  isRequired: boolean;
  /** Name of the conditional path this field belongs to (e.g.,
   *  "cliente_com_fatura"). When set, the field is only used when that
   *  scenario applies. Null = unconditional. */
  group?: string | null;
  /** Name of a mutually-exclusive choice set (e.g., "canal_envio").
   *  All fields with the same mutexGroup are alternatives — operator picks
   *  exactly one. Null = independent. */
  mutexGroup?: string | null;
}

export interface TemplateFieldsResponse {
  templateId: string | null;
  templateName: string | null;
  matchType: string | null;
  mandatoryInfoText: string | null;
  fields: TemplateField[];
  fromCache: boolean;
}

const EXTRACTION_INSTRUCTION = `Voce e um extrator de campos de templates de resposta regulatoria (Anatel). Sua unica tarefa: identificar quais DADOS o operador de backoffice precisa fornecer para o template ser preenchido e enviado ao consumidor.

CADA CAMPO TEM ATE 5 ATRIBUTOS:
- key, label, type (obrigatorios)
- isRequired (boolean) — campo obrigatorio em TODOS os caminhos do template? true se sim, false se condicional/opcional
- group (string|null) — nome do BLOCO CONDICIONAL onde o campo aparece (ex: "cliente_com_fatura", "cliente_sem_valores"). null se o campo aparece em todos os caminhos
- mutexGroup (string|null) — nome do GRUPO DE EXCLUSAO MUTUA (ex: "canal_envio"). Campos no mesmo mutexGroup sao alternativas: operador preenche apenas UM.

# Padroes que voce reconhece

## 1. Bloco "INFORMACOES OBRIGATORIAS:"
Quando existir, cada item listado e um campo. Ex:
  "INFORMACOES OBRIGATORIAS: Data do pedido de cancelamento e valor do estorno."
  -> [{"key":"data_pedido_cancelamento","label":"Data do pedido de cancelamento","type":"date"},
      {"key":"valor_estorno","label":"Valor do estorno","type":"number"}]

## 2. Placeholders {{key}} no estilo handlebars
Cada {{algo}} vira um campo direto. Ex:
  "Prezado(a) {{nome_reclamante}}, valor de R$ {{valor_estorno}}"
  -> [{"key":"nome_reclamante","label":"Nome do reclamante","type":"text"},
      {"key":"valor_estorno","label":"Valor do estorno","type":"number"}]

## 3. Sequencias de X (estilo Anatel antigo)
XX, XXXXXXXXX, R$XX,XX, XX/XX/XX, XXX@XXX.COM.BR sao mascaras a preencher.
INFIRA o nome do campo pela PALAVRA DE CONTEXTO mais proxima:

| Trecho do template                          | Campo gerado                                |
|---------------------------------------------|---------------------------------------------|
| vencimento XX/XX                            | data_vencimento (date)                      |
| dia XX/XX                                   | data_envio (date)                           |
| protocolo XXXXXXXXXXXX                      | numero_protocolo (text)                     |
| numero XX XXXXXXXXX                         | numero_telefone (text)                      |
| para o e-mail XXX@XXX.COM                   | email_cliente (text)                        |
| endereco XX XXXXXXXXXXX                     | endereco (text)                             |
| valor de R$XX,XX                            | valor (number)                              |
| valor original de R$XX,XX para R$XX,XX      | valor_original + valor_ajustado (2 campos)  |
| pelo prazo de XX dias                       | prazo_dias (number)                         |
| linha XXXXXXXXX                             | numero_linha (text)                         |

## 4. Colchetes alternativos e BLOCOS condicionais

### 4a. Linha de canais alternativos: [A] / [B] / [C]
Quando os colchetes aparecem na mesma linha separados por "/" ou "ou", sao MUTUAMENTE EXCLUSIVOS.
Cada UM vira campo separado, todos com mesmo mutexGroup e isRequired=false. Operador escolhe um.

Ex: "[e-mail XX@XX.com.br] / [endereco - Rua XXX] / [whatsapp do numero XXXXXXX]"
->
  {"key":"email_cliente","label":"E-mail do cliente","type":"text","isRequired":false,"mutexGroup":"canal_envio"}
  {"key":"endereco","label":"Endereco","type":"text","isRequired":false,"mutexGroup":"canal_envio"}
  {"key":"numero_whatsapp","label":"Numero do WhatsApp","type":"text","isRequired":false,"mutexGroup":"canal_envio"}

### 4b. Bloco condicional: [Cliente com fatura em aberto], [Cliente sem valores em aberto], etc.
Quando uma linha em colchetes nomeia uma CONDICAO/CENARIO e tem texto abaixo, isso e o INICIO de um bloco condicional.
Todos os placeholders dentro do bloco (ate o proximo bloco ou fim) recebem isRequired=false e group="<nome_normalizado_do_bloco>".

Ex:
  [Cliente com fatura em aberto]
  ... ajuste da fatura com vencimento em XX/XX, valor de R$XX,XX ...
->
  {"key":"data_vencimento_ajustada","label":"Data de vencimento ajustada","type":"date","isRequired":false,"group":"cliente_com_fatura_em_aberto"}
  {"key":"valor_ajustado","label":"Valor ajustado","type":"number","isRequired":false,"group":"cliente_com_fatura_em_aberto"}

### 4c. Marcacao em bloco unico
"[detalhar em caso de ...]" ou "[informar XYZ]" sao campos descritivos diretos (isRequired=false, sem group), nao opcoes de canal.

REGRA GERAL: Placeholders FORA de qualquer bloco condicional/mutex (na "linha de base" do template, executada SEMPRE) sao isRequired=true, group=null, mutexGroup=null.

# Regras rigidas

- "key": snake_case, sem acentos, somente [a-z0-9_]. Curto e canonico.
- "label": rotulo claro em portugues, maiuscula inicial, SEM ponto final.
- "type": "date" para datas, "number" para valores monetarios/percentuais/quantidades, "text" para o resto.
- NUNCA invente campos sem ancora no texto.
- NUNCA duplique semantica (mesmo conceito = 1 campo so).
- IGNORE: frases meta ("conforme historico de atendimento"), enderecos de ORIGEM ja preenchidos com dominios fixos (XXX@TIMBRASIL.COM.BR, atendimento@tim.com.br), nomes de departamentos.
- Se NENHUM campo for identificavel, retorne {"fields":[]}.

# Output
Responda SOMENTE com JSON valido, SEM markdown, SEM comentarios, SEM texto antes ou depois.
Os atributos group e mutexGroup podem ser omitidos (ou null) quando o campo nao se aplica:
{"fields":[{"key":"...","label":"...","type":"date|number|text","isRequired":true,"group":null,"mutexGroup":null}]}`;

function extractMandatoryInfoSection(templateContent: string): string | null {
  const re = /INFORMA[CÇ][OÕ]ES\s+OBRIGAT[OÓ]RIAS\s*:?\s*([\s\S]*?)(?=\bMODELO\s+DE\s+RESPOSTA\b|\bQUANDO\s+USAR\b|\bREGRA\b|$)/i;
  const m = templateContent.match(re);
  const text = m?.[1]?.trim();
  return text && text.length > 0 ? text : null;
}

/** Picks the chunk of the template that's most useful for field extraction:
 *  preferentially INFORMACOES OBRIGATORIAS + MODELO DE RESPOSTA, otherwise the
 *  full content. Keeps the LLM input focused without losing the placeholder
 *  context needed to infer XX-style fields. */
function buildExtractionContext(templateContent: string): { text: string; mandatoryInfoText: string | null } {
  const mandatoryInfoText = extractMandatoryInfoSection(templateContent);
  const modeloMatch = templateContent.match(/MODELO\s+DE\s+RESPOSTA\s*:?\s*([\s\S]+)$/i);
  const modeloText = modeloMatch?.[1]?.trim() ?? null;

  if (mandatoryInfoText && modeloText) {
    return {
      text: `INFORMACOES OBRIGATORIAS:\n${mandatoryInfoText}\n\nMODELO DE RESPOSTA:\n${modeloText}`,
      mandatoryInfoText,
    };
  }
  if (mandatoryInfoText) return { text: mandatoryInfoText, mandatoryInfoText };
  if (modeloText) return { text: modeloText, mandatoryInfoText: null };
  return { text: templateContent.trim(), mandatoryInfoText: null };
}

function parseLLMOutput(raw: string): TemplateField[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed?.fields) ? parsed.fields : [];
    const seen = new Set<string>();
    const out: TemplateField[] = [];
    for (const f of arr) {
      if (!f || typeof f.key !== 'string' || typeof f.label !== 'string') continue;
      const key = f.key.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const type: TemplateFieldType = f.type === 'date' || f.type === 'number' ? f.type : 'text';
      // Conditional metadata — group/mutexGroup are optional in the LLM output;
      // default to null (unconditional). isRequired defaults to true unless the
      // model explicitly marks it false.
      const group = typeof f.group === 'string' && f.group.trim() ? f.group.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_') : null;
      const mutexGroup = typeof f.mutexGroup === 'string' && f.mutexGroup.trim() ? f.mutexGroup.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_') : null;
      const isRequired = f.isRequired === false ? false : true;
      out.push({
        key,
        label: f.label.trim(),
        type,
        source: 'template',
        isRequired,
        group,
        mutexGroup,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Map a mandatory_info_rule fieldName/validationRule to the input type the operator UI renders.
function inferTypeFromFieldName(fieldName: string, validationRule: string | null): TemplateFieldType {
  if (validationRule === 'cpf' || validationRule === 'cnpj' || validationRule === 'numero_protocolo') {
    return 'text';
  }
  if (validationRule === 'date' || /^data_|_data$/i.test(fieldName)) return 'date';
  if (/(^numero_|_numero$|valor|preco|qtd|quantidade)/i.test(fieldName)) return 'text';
  return 'text';
}

/** Pulls every `{{placeholder}}` from the template body and turns each into a
 *  TemplateField. Normalizes the key (lowercase, non-word → _) and infers a
 *  type from the name. This catches modern templates that don't bother with
 *  the "INFORMACOES OBRIGATORIAS:" section and just inline placeholders. */
function extractHandlebarsFields(content: string): TemplateField[] {
  if (!content) return [];
  const matches = content.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g);
  const seen = new Set<string>();
  const out: TemplateField[] = [];
  for (const m of matches) {
    const raw = (m[1] ?? '').trim();
    if (!raw) continue;
    const key = raw
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    let type: TemplateFieldType = 'text';
    if (/^data_|_data$|\bdata\b/i.test(key)) type = 'date';
    else if (/(valor|preco|qtd|quantidade|saldo)/.test(key)) type = 'text';
    // Build a human label from the raw text: "data_reclamacao" → "Data Reclamacao"
    const label = raw
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    out.push({ key, label, type, source: 'template', isRequired: true, group: null, mutexGroup: null });
  }
  return out;
}

export interface ReprocessResult {
  total: number;
  processed: number;
  alreadyCached: number;
  failed: number;
  totalFields: number;
}

@Injectable()
export class TemplateFieldsExtractorService {
  private readonly logger = new Logger(TemplateFieldsExtractorService.name);

  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(ResponseTemplate)
    private readonly templateRepo: Repository<ResponseTemplate>,
    private readonly templateResolver: TemplateResolverService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
    private readonly modelSelector: ModelSelectorService,
  ) {}

  /**
   * Returns the list of operator-input fields the current ticket needs.
   * Uses the response_template's "INFORMAÇÕES OBRIGATÓRIAS:" section and
   * caches the extracted shape on the template row to avoid repeat LLM calls.
   */
  async getFieldsForComplaint(complaintId: string): Promise<TemplateFieldsResponse> {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      select: ['id', 'tipologyId', 'situationId'],
    });
    if (!complaint) throw new NotFoundException(`Complaint ${complaintId} not found`);

    // 1. Always include Anatel global+tipology mandatory fields (mandatory_info_rule).
    //    These are the 6 fields the regulatory checklist enforces and must reach
    //    the operator BEFORE processing starts so they can be collected manually.
    const anatelFields: TemplateField[] = [];
    if (complaint.tipologyId) {
      const rules = await this.mandatoryInfoResolver.resolve(
        complaint.tipologyId,
        complaint.situationId ?? null,
      );
      for (const r of rules) {
        anatelFields.push({
          key: r.fieldName,
          label: r.fieldLabel,
          type: inferTypeFromFieldName(r.fieldName, r.validationRule),
          source: 'anatel',
          isRequired: r.isRequired,
        });
      }
    }

    if (!complaint.tipologyId) {
      return {
        templateId: null,
        templateName: null,
        matchType: null,
        mandatoryInfoText: null,
        fields: anatelFields,
        fromCache: false,
      };
    }

    // 2. Resolve the response template and extract its "INFORMAÇÕES OBRIGATÓRIAS:"
    //    section, then LLM-extract structured fields (cached on the template row).
    const resolved = await this.templateResolver.resolve(complaint.tipologyId, complaint.situationId ?? null, complaint.id);
    if (!resolved) {
      return {
        templateId: null,
        templateName: null,
        matchType: null,
        mandatoryInfoText: null,
        fields: anatelFields,
        fromCache: false,
      };
    }

    const mandatoryInfoText = extractMandatoryInfoSection(resolved.templateContent);
    let templateFields: TemplateField[] = [];
    let fromCache = false;

    // Cache hit short-circuits the LLM round trip
    const templateRow = await this.templateRepo.findOne({ where: { id: resolved.id } });
    if (templateRow?.requiredFieldsCache?.fields && Array.isArray(templateRow.requiredFieldsCache.fields)) {
      templateFields = templateRow.requiredFieldsCache.fields.map((f: any) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        source: 'template' as TemplateFieldSource,
        isRequired: f.isRequired ?? true,
      }));
      fromCache = true;
    } else {
      templateFields = await this.extractAndPersist(resolved.id, resolved.templateContent);
    }

    // 3. Merge — anatel first (canonical names), then template fields deduped by key.
    const seen = new Set(anatelFields.map((f) => f.key));
    const merged: TemplateField[] = [...anatelFields];
    for (const f of templateFields) {
      if (!seen.has(f.key)) {
        merged.push(f);
        seen.add(f.key);
      }
    }

    return {
      templateId: resolved.id,
      templateName: resolved.name,
      matchType: resolved.matchType,
      mandatoryInfoText,
      fields: merged,
      fromCache,
    };
  }

  /** Runs the LLM extraction over the INFORMACOES OBRIGATORIAS section (when
   *  present), unions in every {{handlebars}} placeholder found in the body,
   *  persists the result to the template's requiredFieldsCache, and returns
   *  the merged list. Returns [] only when neither path yielded anything. */
  private async extractAndPersist(
    templateId: string,
    templateContent: string,
  ): Promise<TemplateField[]> {
    const { text: llmInput } = buildExtractionContext(templateContent);
    let llmFields: TemplateField[] = [];
    if (llmInput) {
      try {
        // 'composicao' = gpt-4o (powerful tier). Field extraction needs strong
        // context-inference for XX-style placeholders, so we trade cost for
        // quality. Falls back to other configured providers via callWithFallback.
        llmFields = await this.modelSelector.callWithFallback('composicao', async ({ model, config }) => {
          const { text } = await generateText({
            model,
            temperature: 0.1,
            maxOutputTokens: 1200,
            messages: [
              { role: 'system', content: EXTRACTION_INSTRUCTION },
              { role: 'user', content: llmInput },
            ],
          });
          this.logger.log(`template-fields LLM extracted via ${config.provider}/${config.modelId} (${(text ?? '').length} chars)`);
          return parseLLMOutput(text ?? '');
        });
      } catch (err) {
        this.logger.warn(`LLM extraction failed for template ${templateId}: ${err}`);
      }
    }

    const handlebarsFields = extractHandlebarsFields(templateContent);

    // Merge — LLM-extracted fields first (richer labels), then handlebars dedup by key
    const seen = new Set<string>();
    const merged: TemplateField[] = [];
    for (const f of [...llmFields, ...handlebarsFields]) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      merged.push(f);
    }

    try {
      await this.templateRepo.update(templateId, { requiredFieldsCache: { fields: merged } });
    } catch (err) {
      this.logger.warn(`Failed to persist requiredFieldsCache for template ${templateId}: ${err}`);
    }
    return merged;
  }

  /** Re-extracts fields for a single template by id. When `force=false`,
   *  honors an existing cache; when `force=true`, ignores cache and re-runs
   *  the LLM + handlebars extraction. Used by the /admin button. */
  async reprocessTemplate(
    templateId: string,
    force = false,
  ): Promise<{ templateId: string; templateName: string | null; fields: TemplateField[]; fromCache: boolean }> {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    if (!force && template.requiredFieldsCache?.fields?.length) {
      return {
        templateId,
        templateName: template.name ?? null,
        fields: template.requiredFieldsCache.fields as TemplateField[],
        fromCache: true,
      };
    }

    const fields = await this.extractAndPersist(templateId, template.templateContent);
    return { templateId, templateName: template.name ?? null, fields, fromCache: false };
  }

  /** Bulk-reprocesses every active template. `force=true` ignores the cache so
   *  templates that previously had no fields detected (because they only used
   *  {{handlebars}} and no INFORMACOES OBRIGATORIAS section) are picked up. */
  async reprocessAll(force = false): Promise<ReprocessResult> {
    const all = await this.templateRepo.find({ where: { isActive: true } });
    let processed = 0;
    let alreadyCached = 0;
    let failed = 0;
    let totalFields = 0;
    for (const t of all) {
      try {
        const result = await this.reprocessTemplate(t.id, force);
        if (result.fromCache) alreadyCached++;
        else processed++;
        totalFields += result.fields.length;
      } catch (err) {
        this.logger.warn(`Reprocess failed for template ${t.id}: ${err}`);
        failed++;
      }
    }
    this.logger.log(`reprocessAll done — total=${all.length} processed=${processed} cached=${alreadyCached} failed=${failed} fields=${totalFields}`);
    return { total: all.length, processed, alreadyCached, failed, totalFields };
  }
}
