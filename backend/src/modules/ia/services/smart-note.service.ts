import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { ModelSelectorService } from './model-selector.service';

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

@Injectable()
export class SmartNoteService {
  private readonly logger = new Logger(SmartNoteService.name);

  constructor(private readonly modelSelector: ModelSelectorService) {}

  async process(action: SmartNoteAction, text: string): Promise<{ text: string; model: string; provider: string }> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Texto vazio.');
    }
    if (trimmed.length > 4000) {
      throw new BadRequestException('Texto muito longo (limite 4000 caracteres).');
    }
    const instruction = ACTION_PROMPTS[action];
    if (!instruction) {
      throw new BadRequestException(`Ação inválida: ${action}`);
    }

    return this.modelSelector.callWithFallback('classificacao', async ({ model, config }) => {
      const { text: output } = await generateText({
        model,
        temperature: action === 'corrigir' ? 0.1 : 0.3,
        maxOutputTokens: 800,
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: trimmed },
        ],
      });
      const clean = (output ?? '').trim();
      this.logger.log(`smart-note ${action} ok (${config.provider}/${config.modelId}, ${clean.length} chars)`);
      return { text: clean, model: config.modelId, provider: config.provider };
    });
  }
}
