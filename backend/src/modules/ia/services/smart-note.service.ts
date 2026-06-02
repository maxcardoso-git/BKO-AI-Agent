import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ModelSelectorService } from './model-selector.service';
import { Complaint } from '../../operacao/entities/complaint.entity';
import { Persona } from '../../regulatorio/entities/persona.entity';

export type SmartNoteAction =
  | 'elaborar'
  | 'resumir'
  | 'corrigir'
  | 'reformular'
  | 'formalizar';

const ACTION_PROMPTS: Record<SmartNoteAction, string> = {
  elaborar:
    'Reescreva o texto abaixo expandindo os pontos com mais detalhe operacional (passos, valores, datas, motivos). Mantenha o sentido original. Texto curto e objetivo, em português do Brasil. Não invente fatos que não estejam no texto. Retorne apenas o texto final, sem comentários, sem markdown e sem rótulos.',
  resumir:
    'Resuma o texto abaixo em frases curtas e objetivas, preservando todos os fatos (valores, datas, números de protocolo, ações já tomadas). Em português do Brasil. Retorne apenas o resumo, sem comentários, sem markdown e sem rótulos.',
  corrigir:
    'Corrija ortografia, gramática e pontuação do texto abaixo, sem alterar o conteúdo nem o tom. Mantenha exatamente as mesmas informações. Em português do Brasil. Retorne apenas o texto corrigido, sem comentários, sem markdown e sem rótulos.',
  reformular:
    'Reescreva o texto abaixo de forma mais clara e objetiva, sem alterar o conteúdo factual. Em português do Brasil. Retorne apenas o texto reformulado, sem comentários, sem markdown e sem rótulos.',
  formalizar:
    'Reescreva o texto abaixo em registro formal de atendimento, próprio para nota de operador de backoffice. Mantenha todos os fatos. Em português do Brasil. Retorne apenas o texto final, sem comentários, sem markdown e sem rótulos.',
};

function formalityLabel(n: number): string {
  if (n <= 1) return 'informal';
  if (n <= 3) return 'neutro';
  return 'formal';
}
function levelLabel(n: number): string {
  if (n <= 33) return 'baixo';
  if (n <= 66) return 'medio';
  return 'alto';
}

function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function stripHtml(s: string): string {
  return (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface SmartNoteResult {
  text: string;
  model: string;
  provider: string;
  persona?: { id: string; name: string };
}

export interface PersonaCheckResult {
  persona: { id: string; name: string } | null;
  forbidden: string[];
  missing: string[];
}

@Injectable()
export class SmartNoteService {
  private readonly logger = new Logger(SmartNoteService.name);

  constructor(
    private readonly modelSelector: ModelSelectorService,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
  ) {}

  /**
   * Processes a snippet through one of the 5 actions, optionally biased by the
   * persona attached to the complaint's tipology. When complaintId is provided
   * and a persona exists, its tone + required + forbidden expressions get
   * injected into the system prompt so the generated text follows the
   * established style.
   */
  async process(
    action: SmartNoteAction,
    text: string,
    complaintId?: string,
  ): Promise<SmartNoteResult> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) throw new BadRequestException('Texto vazio.');
    if (trimmed.length > 4000) {
      throw new BadRequestException('Texto muito longo (limite 4000 caracteres).');
    }
    const baseInstruction = ACTION_PROMPTS[action];
    if (!baseInstruction) throw new BadRequestException(`Ação inválida: ${action}`);

    let personaInfo: { id: string; name: string } | undefined;
    let personaSuffix = '';
    if (complaintId) {
      const persona = await this.findPersonaForComplaint(complaintId);
      if (persona) {
        personaInfo = { id: persona.id, name: persona.name };
        personaSuffix = this.buildPersonaSuffix(persona);
      }
    }

    const fullInstruction = personaSuffix
      ? `${baseInstruction}\n\n${personaSuffix}`
      : baseInstruction;

    return this.modelSelector.callWithFallback('classificacao', async ({ model, config }) => {
      const { text: output } = await generateText({
        model,
        temperature: action === 'corrigir' ? 0.1 : 0.3,
        maxOutputTokens: 800,
        messages: [
          { role: 'system', content: fullInstruction },
          { role: 'user', content: trimmed },
        ],
      });
      const clean = (output ?? '').trim();
      this.logger.log(
        `smart-note ${action} ok (${config.provider}/${config.modelId}, ${clean.length} chars, persona=${personaInfo?.name ?? 'none'})`,
      );
      return { text: clean, model: config.modelId, provider: config.provider, persona: personaInfo };
    });
  }

  /**
   * Validates text against the persona attached to the complaint. Returns the
   * list of forbidden expressions present in the text and the list of required
   * expressions missing from it. Used by the /validar Aprovar/Corrigir flow
   * to block submissions that don't match the persona style.
   *
   * The text is HTML-stripped before checking (operator types via RichTextArea)
   * and both sides are normalized (lowercase + diacritics removed) so accent
   * mismatches don't produce false positives.
   */
  async checkPersona(complaintId: string, text: string): Promise<PersonaCheckResult> {
    const persona = await this.findPersonaForComplaint(complaintId);
    if (!persona) return { persona: null, forbidden: [], missing: [] };

    const plain = stripHtml(text ?? '');
    const normText = normalize(plain);

    const forbidden: string[] = [];
    for (const expr of persona.forbiddenExpressions ?? []) {
      const e = (expr ?? '').trim();
      if (!e) continue;
      if (normText.includes(normalize(e))) forbidden.push(e);
    }

    const missing: string[] = [];
    for (const expr of persona.requiredExpressions ?? []) {
      const e = (expr ?? '').trim();
      if (!e) continue;
      if (!normText.includes(normalize(e))) missing.push(e);
    }

    return {
      persona: { id: persona.id, name: persona.name },
      forbidden,
      missing,
    };
  }

  /** Finds the active persona for the complaint's tipologyId. Falls back to a
   *  global persona (tipologyId IS NULL) when no specific one exists. */
  async findPersonaForComplaint(complaintId: string): Promise<Persona | null> {
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      select: ['id', 'tipologyId'],
    });
    if (!complaint) return null;
    if (complaint.tipologyId) {
      const specific = await this.personaRepo.findOne({
        where: { tipologyId: complaint.tipologyId, isActive: true },
      });
      if (specific) return specific;
    }
    // Default persona (no tipology)
    return this.personaRepo.findOne({
      where: { tipologyId: IsNull(), isActive: true },
    });
  }

  private buildPersonaSuffix(persona: Persona): string {
    const lines: string[] = [
      `--- Diretrizes da persona "${persona.name}" ---`,
      `Tom esperado: formalidade=${formalityLabel(persona.formalityLevel)}, empatia=${levelLabel(persona.empathyLevel)}, assertividade=${levelLabel(persona.assertivenessLevel)}.`,
    ];
    if (persona.instructions && persona.instructions.trim().length > 0) {
      lines.push('', persona.instructions.trim());
    }
    if (persona.requiredExpressions && persona.requiredExpressions.length > 0) {
      lines.push(
        `Inclua naturalmente estas expressões no texto: ${persona.requiredExpressions.join(', ')}.`,
      );
    }
    if (persona.forbiddenExpressions && persona.forbiddenExpressions.length > 0) {
      lines.push(
        `Não use, em hipótese nenhuma, estas palavras/expressões: ${persona.forbiddenExpressions.join(', ')}.`,
      );
    }
    return lines.join('\n');
  }
}
