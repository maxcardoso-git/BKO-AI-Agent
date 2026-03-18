import { Injectable } from '@nestjs/common';
import { VectorSearchResult } from '../../base-de-conhecimento/services/vector-search.service';
import { ResolvedTemplate } from '../../base-de-conhecimento/services/template-resolver.service';
import { ResolvedMandatoryField } from '../../base-de-conhecimento/services/mandatory-info-resolver.service';

export interface PromptContext {
  complaintText: string;
  tipologyKey: string;
  tipologyName?: string;
  situationKey?: string | null;
  slaDeadline?: string;
  slaBusinessDays?: number;
  protocolNumber?: string;
  consumerName?: string;
  kbChunks?: VectorSearchResult[];
  template?: ResolvedTemplate | null;
  mandatoryFields?: ResolvedMandatoryField[];
  personaTone?: string;
  personaInstructions?: string;
  previousStepOutputs?: Record<string, Record<string, unknown>>;
  // Memory-augmented context (MEM-01..MEM-06)
  similarCases?: Array<{ metadata: Record<string, unknown>; similarity: number }>;
  humanCorrections?: Array<{ aiText: string; humanText: string; diffDescription: string; similarity: number }>;
  stylePatterns?: Array<{ expression: string; type: 'approved' | 'forbidden' }>;
}

@Injectable()
export class PromptBuilderService {
  /**
   * Builds a system prompt for complaint classification/parsing.
   */
  buildClassificationPrompt(ctx: PromptContext): { system: string; user: string } {
    const system = [
      'Voce e um especialista em classificacao de reclamacoes de telecomunicacoes no contexto regulatorio da Anatel.',
      'Sua tarefa e extrair dados estruturados da reclamacao do consumidor.',
      '',
      'Regras:',
      '- Identifique a tipologia correta (cobranca, portabilidade, qualidade, cancelamento, etc.)',
      '- Extraia os fatos-chave da reclamacao',
      '- Avalie o nivel de urgencia/risco',
      '- Responda APENAS com os dados estruturados solicitados',
    ];

    if (ctx.kbChunks && ctx.kbChunks.length > 0) {
      system.push('', '## Contexto regulatorio (Manual Anatel):');
      for (const chunk of ctx.kbChunks) {
        system.push(`---`);
        system.push(chunk.content);
      }
    }

    const user = [
      `## Reclamacao (Protocolo: ${ctx.protocolNumber ?? 'N/A'})`,
      '',
      ctx.complaintText,
    ];

    return { system: system.join('\n'), user: user.join('\n') };
  }

  /**
   * Builds a system prompt for draft response generation.
   */
  buildDraftResponsePrompt(ctx: PromptContext): { system: string; user: string } {
    const system = [
      'Voce e um redator especializado em respostas a reclamacoes de telecomunicacoes para a Anatel.',
      'Sua tarefa e redigir uma resposta completa e em conformidade regulatoria.',
      '',
      'Diretrizes:',
      '- A resposta deve ser clara, objetiva e profissional',
      '- Deve enderecar todos os pontos da reclamacao do consumidor',
      '- Deve citar as acoes tomadas pela operadora',
      '- Deve seguir o template IQI quando disponivel',
    ];

    if (ctx.personaTone) {
      system.push('', `## Tom e estilo: ${ctx.personaTone}`);
    }
    if (ctx.personaInstructions) {
      system.push(ctx.personaInstructions);
    }

    if (ctx.template) {
      system.push('', '## Template IQI de referencia:');
      system.push(ctx.template.templateContent);
    }

    if (ctx.mandatoryFields && ctx.mandatoryFields.length > 0) {
      system.push('', '## Itens obrigatorios que DEVEM constar na resposta:');
      for (const field of ctx.mandatoryFields) {
        system.push(`- ${field.fieldLabel}: ${field.description ?? field.fieldName}`);
      }
    }

    if (ctx.kbChunks && ctx.kbChunks.length > 0) {
      system.push('', '## Contexto regulatorio relevante:');
      for (const chunk of ctx.kbChunks) {
        system.push('---');
        system.push(chunk.content);
      }
    }

    if (ctx.similarCases && ctx.similarCases.length > 0) {
      system.push('', '## Casos similares resolvidos anteriormente:');
      for (const c of ctx.similarCases) {
        system.push(`- Similaridade: ${(c.similarity * 100).toFixed(0)}% | ${JSON.stringify(c.metadata)}`);
      }
    }

    if (ctx.humanCorrections && ctx.humanCorrections.length > 0) {
      system.push('', '## Correcoes humanas em respostas anteriores similares:');
      for (const h of ctx.humanCorrections) {
        system.push(`- Correcao (${(h.similarity * 100).toFixed(0)}% similar): ${h.diffDescription}`);
        system.push(`  Versao humana aprovada: ${h.humanText.slice(0, 300)}`);
      }
    }

    if (ctx.stylePatterns && ctx.stylePatterns.length > 0) {
      const approved = ctx.stylePatterns.filter(p => p.type === 'approved');
      const forbidden = ctx.stylePatterns.filter(p => p.type === 'forbidden');
      if (approved.length > 0) {
        system.push('', '## Expressoes aprovadas para esta tipologia (use estas):');
        for (const p of approved) {
          system.push(`- "${p.expression}"`);
        }
      }
      if (forbidden.length > 0) {
        system.push('', '## Expressoes proibidas para esta tipologia (evite estas):');
        for (const p of forbidden) {
          system.push(`- "${p.expression}"`);
        }
      }
    }

    const user = [
      `## Dados da reclamacao`,
      `- Protocolo: ${ctx.protocolNumber ?? 'N/A'}`,
      `- Tipologia: ${ctx.tipologyName ?? ctx.tipologyKey}`,
      `- Situacao: ${ctx.situationKey ?? 'N/A'}`,
      `- Prazo SLA: ${ctx.slaDeadline ?? 'N/A'} (${ctx.slaBusinessDays ?? '?'} dias uteis)`,
      `- Consumidor: ${ctx.consumerName ?? 'N/A'}`,
      '',
      '## Texto da reclamacao:',
      ctx.complaintText,
    ];

    if (ctx.previousStepOutputs) {
      const classificationOutput = ctx.previousStepOutputs['ClassifyTypology'];
      if (classificationOutput) {
        user.push('', '## Resultado da classificacao:');
        user.push(JSON.stringify(classificationOutput, null, 2));
      }
    }

    return { system: system.join('\n'), user: user.join('\n') };
  }

  /**
   * Builds a system prompt for compliance evaluation.
   */
  buildCompliancePrompt(ctx: PromptContext & { draftResponse: string }): { system: string; user: string } {
    const system = [
      'Voce e um auditor de conformidade regulatoria da Anatel.',
      'Sua tarefa e avaliar se a resposta redigida atende todos os requisitos regulatorios.',
      '',
      'Criterios de avaliacao:',
      '- Completude: todos os itens obrigatorios estao presentes?',
      '- Aderencia: a resposta segue o Manual Anatel e o template IQI?',
      '- Linguagem: o tom e apropriado e profissional?',
      '- Prazo: ha referencia ao prazo e cumprimento do SLA?',
    ];

    if (ctx.mandatoryFields && ctx.mandatoryFields.length > 0) {
      system.push('', '## Itens obrigatorios a verificar:');
      for (const field of ctx.mandatoryFields) {
        system.push(`- ${field.fieldLabel} (${field.isRequired ? 'OBRIGATORIO' : 'OPCIONAL'})`);
      }
    }

    if (ctx.kbChunks && ctx.kbChunks.length > 0) {
      system.push('', '## Regras regulatorias aplicaveis:');
      for (const chunk of ctx.kbChunks) {
        system.push('---');
        system.push(chunk.content);
      }
    }

    const user = [
      '## Resposta a avaliar:',
      ctx.draftResponse,
      '',
      '## Reclamacao original:',
      ctx.complaintText,
      '',
      `Tipologia: ${ctx.tipologyKey}`,
      `Situacao: ${ctx.situationKey ?? 'N/A'}`,
    ];

    return { system: system.join('\n'), user: user.join('\n') };
  }
}
