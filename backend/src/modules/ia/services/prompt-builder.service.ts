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
  humanRejections?: Array<{ aiText: string; rejectionReason: string; similarity: number | null }>;
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

    // -------------------------------------------------------------------
    // REGRAS ABSOLUTAS — precedem QUALQUER outra instrução, persona ou template.
    // O bloco existe porque o modelo, sem isso, alucinava datas, prazos,
    // telefones, ações tomadas e valores "plausíveis" para preencher
    // placeholders. Resposta regulatória NÃO tolera invenção.
    // -------------------------------------------------------------------
    system.push(
      '## REGRAS ABSOLUTAS (precedem tudo, inclusive template e persona)',
      '',
      'Esta é uma resposta REGULATÓRIA da Anatel. Errar fato vira multa.',
      '',
      '1. NUNCA invente: datas, valores, prazos, telefones, números de protocolo, ações tomadas, status de cobrança, prazos de estorno, números de ouvidoria, endereços, planos, serviços.',
      '2. Use APENAS dados explícitos de DUAS fontes: (a) reclamação do consumidor e (b) nota do operador + parâmetros estruturados. Não invente nada além disso.',
      '3. Se o template tiver um placeholder e a fonte NÃO tiver dado correspondente, escreva literalmente "A ser informado pela operadora" no lugar — NÃO chute valor plausível.',
      '4. Datas: copie EXATAMENTE como vieram da nota do operador. Não converta, não reformule, não infira datas que não estejam na nota.',
      '5. Telefones, 0800, ouvidoria: só mencione se aparecerem explicitamente na nota do operador ou no texto da reclamação. Caso contrário, NÃO escreva nada sobre canal de contato.',
      '6. Prazos (estorno, devolução, reativação): só mencione se vierem da nota do operador. Sem default. Sem "5 a 10 dias úteis" automático.',
      '7. Ações tomadas pela operadora (reativação, cancelamento, estorno, ressarcimento): só se constarem na nota do operador campo "providencia_adotada" ou texto livre. Nunca presuma ação.',
      '8. Se faltar dado para alguma seção do template, é PREFERÍVEL deixar a seção vazia com "[dado pendente]" do que preencher com texto plausível.',
      '',
    );

    if (customSystemPrompt) {
      system.push(customSystemPrompt);
    } else {
      system.push(
        'Você é um redator regulatório da Anatel.',
        'Sua tarefa: redigir resposta ao consumidor usando exclusivamente os fatos fornecidos.',
        '',
        'Diretrizes (subordinadas às REGRAS ABSOLUTAS acima):',
        '- Resposta clara, objetiva, profissional, em português do Brasil',
        '- Endereçar APENAS os pontos da reclamação que tenham fato correspondente na nota do operador',
        '- Quando um template IQI estiver presente, seguir sua estrutura',
        '- NÃO adicionar seções ausentes no template',
        '- NÃO omitir seções do template — se faltar dado, use "[dado pendente]"',
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
        '## TEMPLATE IQI (estrutura de referência)',
        'Use o template abaixo como base estrutural da resposta.',
        'IMPORTANTE: substitua cada placeholder ([data], [número], XX/XX, etc.) APENAS pelo valor real correspondente da nota do operador ou da reclamação. Se não houver valor, escreva "[dado pendente]" no lugar do placeholder.',
        '',
        ctx.template.templateContent,
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

    if (ctx.humanRejections && ctx.humanRejections.length > 0) {
      const rejectionLines: string[] = [];
      ctx.humanRejections.forEach((r, idx) => {
        const sim = r.similarity != null ? ` (similaridade ${(r.similarity * 100).toFixed(0)}%)` : '';
        rejectionLines.push(
          `### Rascunho reprovado ${idx + 1}${sim}`,
          `**Rascunho IA reprovado:**`,
          r.aiText,
          ``,
          `**Motivo da reprovacao:**`,
          r.rejectionReason,
          `---`,
        );
      });
      system.push(
        '',
        '## Rascunhos Reprovados Anteriormente (Aprendizado)',
        '',
        'Os rascunhos abaixo foram REPROVADOS por operadores em casos similares — nao puderam ser aproveitados.',
        'NAO repita os padroes desses rascunhos; trate cada motivo de reprovacao como restricao obrigatoria.',
        '',
        ...rejectionLines,
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
