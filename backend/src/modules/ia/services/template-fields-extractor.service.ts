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
}

export interface TemplateFieldsResponse {
  templateId: string | null;
  templateName: string | null;
  matchType: string | null;
  mandatoryInfoText: string | null;
  fields: TemplateField[];
  fromCache: boolean;
}

const EXTRACTION_INSTRUCTION = `Você recebe um texto curto, em português, que descreve as INFORMAÇÕES OBRIGATÓRIAS que um operador de backoffice precisa coletar antes de redigir a resposta a uma reclamação de consumidor.

Extraia desse texto a lista de CAMPOS INDIVIDUAIS que o operador precisa preencher num formulário.

Regras:
- Cada campo distinto vira um objeto.
- "key": identificador curto em snake_case, somente letras minúsculas, números e underscore (ex: "data_pedido_cancelamento").
- "label": rótulo curto e claro em português, começa com letra maiúscula, sem ponto final (ex: "Data do pedido de cancelamento").
- "type": escolha "date" para datas, "number" para valores monetários, percentuais ou quantidades, "text" para o resto.
- NÃO invente campos que não estejam no texto.
- NÃO duplique campos semanticamente equivalentes.
- Ignore frases meta como "conforme histórico de atendimento" ou "nos sistemas da TIM" — não são campos a preencher.
- Se o texto não tiver nenhum campo coletável, retorne fields: [].

Responda SOMENTE com um JSON válido neste formato exato, sem markdown, sem comentários, sem texto antes ou depois:
{"fields":[{"key":"...","label":"...","type":"date|number|text"}]}`;

function extractMandatoryInfoSection(templateContent: string): string | null {
  const re = /INFORMA[CÇ][OÕ]ES\s+OBRIGAT[OÓ]RIAS\s*:?\s*([\s\S]*?)(?=\bMODELO\s+DE\s+RESPOSTA\b|\bQUANDO\s+USAR\b|\bREGRA\b|$)/i;
  const m = templateContent.match(re);
  const text = m?.[1]?.trim();
  return text && text.length > 0 ? text : null;
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
      out.push({ key, label: f.label.trim(), type, source: 'template', isRequired: true });
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
    const resolved = await this.templateResolver.resolve(complaint.tipologyId, complaint.situationId ?? null);
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

    if (mandatoryInfoText) {
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
        templateFields = await this.modelSelector.callWithFallback('classificacao', async ({ model, config }) => {
          const { text } = await generateText({
            model,
            temperature: 0.1,
            maxOutputTokens: 600,
            messages: [
              { role: 'system', content: EXTRACTION_INSTRUCTION },
              { role: 'user', content: mandatoryInfoText },
            ],
          });
          this.logger.log(`template-fields extracted via ${config.provider}/${config.modelId} (${(text ?? '').length} chars)`);
          return parseLLMOutput(text ?? '');
        });
        try {
          await this.templateRepo.update(resolved.id, { requiredFieldsCache: { fields: templateFields } });
        } catch (err) {
          this.logger.warn(`Failed to persist requiredFieldsCache for template ${resolved.id}: ${err}`);
        }
      }
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
}
