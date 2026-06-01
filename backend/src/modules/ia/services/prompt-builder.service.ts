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
  protocoloPrestadora?: string | null;
  consumerName?: string;
  consumerCpf?: string | null;
  /** Contact + cliente fields imported from Turbina that the IQI template may
   *  reference via placeholders. Always optional — the LLM uses whichever the
   *  resolved template needs and ignores the rest. */
  telefoneContatoFixo?: string | null;
  telefoneReclamado?: string | null;
  telefoneWhatsapp?: string | null;
  cpfCnpjAssinante?: string | null;
  justificativa?: string | null;
  clienteEmail?: string | null;
  clienteCep?: string | null;
  avaliacao?: string | null;
  analysisDate?: string;
  kbChunks?: VectorSearchResult[];
  template?: ResolvedTemplate | null;
  mandatoryFields?: ResolvedMandatoryField[];
  personaTone?: string;
  personaInstructions?: string;
  previousStepOutputs?: Record<string, Record<string, unknown>>;
  // PIPE-03: Operator note from complaint_user_note — populated by LoadComplaint skill
  operatorNote?: string | null;
  operatorNoteParameters?: Record<string, unknown> | null;
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
  buildClassificationPrompt(ctx: PromptContext, customSystemPrompt?: string | null): { system: string; user: string } {
    const system: string[] = [];

    if (customSystemPrompt) {
      system.push(customSystemPrompt);
    } else {
      system.push(
        'Voce e um especialista em classificacao de reclamacoes de telecomunicacoes no contexto regulatorio da Anatel.',
        'Sua tarefa e extrair dados estruturados da reclamacao do consumidor.',
        '',
        'Regras:',
        '- Identifique a tipologia correta (cobranca, portabilidade, qualidade, cancelamento, etc.)',
        '- Extraia os fatos-chave da reclamacao',
        '- Avalie o nivel de urgencia/risco',
        '- Responda APENAS com os dados estruturados solicitados',
      );
    }

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
  buildDraftResponsePrompt(ctx: PromptContext, customSystemPrompt?: string | null): { system: string; user: string } {
    const system: string[] = [];

    if (customSystemPrompt) {
      system.push(customSystemPrompt);
    } else {
      system.push(
        'Voce e um redator especializado em respostas a reclamacoes de telecomunicacoes para a Anatel.',
        'Sua tarefa e redigir uma resposta completa e em conformidade regulatoria.',
        '',
        'Diretrizes:',
        '- A resposta deve ser clara, objetiva e profissional',
        '- Deve enderecar todos os pontos da reclamacao do consumidor',
        '- Deve citar as acoes tomadas pela operadora',
        '- OBRIGATORIO: Quando um template IQI estiver disponivel, siga sua estrutura EXATAMENTE',
        '- Preencha todos os {{placeholders}} com os dados reais fornecidos',
        '- NAO adicione secoes que nao existam no template',
        '- NAO omita secoes do template',
      );
    }

    if (ctx.personaTone) {
      system.push('', `## Tom e estilo: ${ctx.personaTone}`);
    }
    if (ctx.personaInstructions) {
      system.push(ctx.personaInstructions);
    }

    if (ctx.template) {
      system.push(
        '',
        '## TEMPLATE OBRIGATORIO (siga EXATAMENTE esta estrutura):',
        'Voce DEVE usar este template como base da resposta.',
        'Substitua cada {{placeholder}} pelo valor real correspondente.',
        'NAO invente campos. Se um dado nao estiver disponivel, use "Nao informado".',
        '',
        ctx.template.templateContent,
        '',
        '## Legenda dos placeholders:',
        '- {{nome_reclamante}} = nome do assinante (se disponivel) ou "Consumidor"',
        '- {{numero_protocolo}} = numero do protocolo Anatel da reclamacao',
        '- {{data_reclamacao}} = data de abertura da reclamacao se disponivel; caso contrario, use a data de analise fornecida nos dados abaixo',
        '- {{providencia_adotada}} = descreva objetivamente a acao tomada pela operadora',
        '- {{status_cobranca}} = "confirmada e o estorno sera processado" ou "contestada" conforme o caso',
        '- {{prazo_estorno}} = numero de dias uteis para o credito (padrao: 5 a 10 dias uteis)',
        '- {{status_cancelamento}}, {{plano_servico}}, {{tipo_servico}}, etc. = use conforme o template aplicavel',
      );
    }

    if (ctx.mandatoryFields && ctx.mandatoryFields.length > 0) {
      system.push('', '## Itens obrigatorios que DEVEM constar na resposta:');
      for (const field of ctx.mandatoryFields) {
        system.push(`- ${field.fieldLabel}: ${field.description ?? field.fieldName}`);
      }
    }

    // PIPE-03: Inject operator note as priority context — comes BEFORE kb chunks so the model
    // sees the operator's brief first. The note may include structured parameters (plano, valor, etc.).
    if (ctx.operatorNote && ctx.operatorNote.trim().length > 0) {
      system.push(
        '',
        '## NOTA DO OPERADOR (contexto prioritario):',
        'O operador analisou o ticket e registrou a seguinte informacao estruturada.',
        'USE estes dados como base factual para a resposta. NAO invente valores nem datas que contradigam a nota.',
        '',
        ctx.operatorNote.trim(),
      );
      if (ctx.operatorNoteParameters && Object.keys(ctx.operatorNoteParameters).length > 0) {
        // Unwrap legacy { dynamicFields: {...} } wrapping — older notes saved
        // the template fields nested. Flatten so each key:value gets its own
        // bullet (the model handles flat lists much better than nested JSON).
        const flat: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(ctx.operatorNoteParameters)) {
          if (k === 'dynamicFields' && v && typeof v === 'object' && !Array.isArray(v)) {
            for (const [innerK, innerV] of Object.entries(v as Record<string, unknown>)) {
              if (!(innerK in flat)) flat[innerK] = innerV;
            }
          } else if (!(k in flat)) {
            flat[k] = v;
          }
        }

        system.push('', '## Parametros estruturados da nota (USE para preencher placeholders do template):');
        for (const [k, v] of Object.entries(flat)) {
          const display = typeof v === 'string' ? v : JSON.stringify(v);
          system.push(`- ${k}: ${display}`);
        }
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
      const correctionLines: string[] = [];
      ctx.humanCorrections.forEach((c, idx) => {
        const sim = c.similarity != null ? ` (similaridade ${(c.similarity * 100).toFixed(0)}%)` : '';
        correctionLines.push(
          `### Exemplo ${idx + 1}${sim}`,
          `**Rascunho IA original:**`,
          c.aiText,
          ``,
          `**Versao corrigida pelo operador:**`,
          c.humanText,
          ``,
          `**Resumo da correcao:**`,
          c.diffDescription,
          `---`,
        );
      });
      system.push(
        '',
        '## Exemplos de Correcoes Humanas Anteriores (Aprendizado)',
        '',
        'Os exemplos abaixo mostram como operadores corrigiram rascunhos previos para casos similares.',
        'USE essas correcoes como guia: evite os padroes que foram corrigidos e adote o estilo das versoes humanas.',
        '',
        ...correctionLines,
      );
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
      `- Protocolo Anatel: ${ctx.protocolNumber ?? 'N/A'}`,
      ...(ctx.protocoloPrestadora ? [`- Protocolo Prestadora: ${ctx.protocoloPrestadora}`] : []),
      `- Tipologia: ${ctx.tipologyName ?? ctx.tipologyKey}`,
      `- Situacao: ${ctx.situationKey ?? 'N/A'}`,
      `- Prazo SLA: ${ctx.slaDeadline ?? 'N/A'} (${ctx.slaBusinessDays ?? '?'} dias uteis)`,
      `- Data de analise (hoje): ${ctx.analysisDate ?? new Date().toLocaleDateString('pt-BR')}`,
      `- Consumidor: ${ctx.consumerName ?? 'Nao identificado no arquivo'}`,
      ...(ctx.consumerCpf ? [`- CPF/CNPJ: ${ctx.consumerCpf}`] : []),
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
  buildCompliancePrompt(ctx: PromptContext & { draftResponse: string }, customSystemPrompt?: string | null): { system: string; user: string } {
    const system: string[] = [];

    if (customSystemPrompt) {
      system.push(customSystemPrompt);
    } else {
      system.push(
        'Voce e um auditor de conformidade regulatoria da Anatel.',
        'Sua tarefa e avaliar se a resposta redigida atende todos os requisitos regulatorios.',
        '',
        'Criterios de avaliacao:',
        '- Completude: todos os itens obrigatorios estao presentes?',
        '- Aderencia: a resposta segue o Manual Anatel e o template IQI?',
        '- Linguagem: o tom e apropriado e profissional?',
        '- Prazo: ha referencia ao prazo e cumprimento do SLA?',
      );
    }

    if (ctx.mandatoryFields && ctx.mandatoryFields.length > 0) {
      system.push('', '## Itens obrigatorios a verificar:');
      for (const field of ctx.mandatoryFields) {
        system.push(`- ${field.fieldLabel} (${field.isRequired ? 'OBRIGATORIO' : 'OPCIONAL'})`);
      }
      system.push(
        '',
        '## Como avaliar mandatoryFieldsStatus (REGRA ESTRITA):',
        '- isPresent = TRUE se a informacao aparece em QUALQUER lugar da resposta, em QUALQUER formato (linha separada, dentro de paragrafo, abreviada, com label diferente, etc).',
        '- Datas em qualquer formato (DD/MM/AAAA, DD/MM, "27/11", "13/05/2026") contam como presentes para campos de data.',
        '- Prazos como "5 a 10 dias uteis", "ate 7 dias", "imediatamente" contam como presentes para campos de prazo.',
        '- Numeros de protocolo (sequencias de 14+ digitos) contam como presentes para campo de protocolo.',
        '- CPF/CNPJ (com ou sem mascara) contam como presentes para campo de documento.',
        '- Nomes proprios contam como presentes para campo de nome do reclamante.',
        '- Em "excerpt", copie o trecho LITERAL da resposta onde o item foi encontrado.',
        '- Marque isPresent = FALSE APENAS se nao encontrar absolutamente nenhuma mencao ao conceito na resposta.',
        '- Nao gere violations para campos que voce marcou como isPresent = true. Violations sao apenas para campos REALMENTE ausentes ou com problema grave.',
      );
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
