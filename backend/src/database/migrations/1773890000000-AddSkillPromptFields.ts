import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkillPromptFields1773890000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skill_definition" ADD COLUMN IF NOT EXISTS "systemPrompt" TEXT`);
    await queryRunner.query(`ALTER TABLE "skill_definition" ADD COLUMN IF NOT EXISTS "userPromptTemplate" TEXT`);
    await queryRunner.query(`ALTER TABLE "skill_definition" ADD COLUMN IF NOT EXISTS "promptVariables" JSONB DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "skill_definition" ADD COLUMN IF NOT EXISTS "skillType" VARCHAR DEFAULT 'code'`);

    // Seed LLM skills with their prompt summaries
    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um especialista em classificacao de reclamacoes de telecomunicacoes no contexto regulatorio da Anatel.
Sua tarefa e extrair dados estruturados da reclamacao do consumidor.

Regras:
- Identifique a tipologia correta (cobranca, portabilidade, qualidade, cancelamento, etc.)
- Extraia os fatos-chave da reclamacao
- Avalie o nivel de urgencia/risco
- Responda APENAS com os dados estruturados solicitados',
        "promptVariables" = '["complaintText", "tipologyKey", "protocolNumber", "kbChunks"]'::jsonb
      WHERE "key" = 'ClassifyTypology'
    `);

    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um especialista em regulamentacao da Anatel e tratamento de reclamacoes de telecomunicacoes.
Analise a reclamacao e determine a acao regulatoria correta.

Regras:
- responder: Reclamacao valida que deve ser respondida normalmente
- reclassificar: Tipologia ou situacao classificada incorretamente, precisa reclassificacao
- reencaminhar: Reclamacao pertence a outra area ou operadora, deve ser reencaminhada
- cancelar: Reclamacao duplicada, sem fundamento, ou consumidor desistiu',
        "promptVariables" = '["complaintText", "tipologyKey", "situationKey"]'::jsonb
      WHERE "key" = 'DetermineRegulatoryAction'
    `);

    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um extrator de entidades especializado em reclamacoes de telecomunicacoes.
Extraia do texto da reclamacao os seguintes dados estruturados:
- Valores monetarios mencionados
- Numeros de protocolo (Anatel e prestadora)
- Datas relevantes
- Nome do consumidor
- CPF/CNPJ
- Servicos mencionados
- Problemas reportados',
        "promptVariables" = '["complaintText", "normalizedText"]'::jsonb
      WHERE "key" = 'ExtractComplaintEntities'
    `);

    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um analista de sentimentos especializado em reclamacoes de telecomunicacoes.
Analise o texto da reclamacao e avalie a propensao do cliente a fazer uma nova reclamacao.

Criterios para o propensityScore (0-100):
- 0-30: Baixo risco. Cliente calmo, primeira reclamacao, sem ameacas
- 31-50: Medio. Alguma frustracao, pode ter historico
- 51-70: Alto. Frustrado, menciona tentativas anteriores sem sucesso
- 71-85: Muito alto. Irritado, ameacas de acao legal ou midia social
- 86-100: Critico. Furioso, multiplas reclamacoes anteriores, ameacas concretas

Analise tambem:
- Tom emocional: identificar palavras-chave de emocao
- Historico: se menciona reclamacoes, protocolos ou contatos anteriores
- Ameacas: juridicas (Procon, advogado, justica) ou sociais (redes sociais, Reclame Aqui)
- Urgencia: palavras como "urgente", "imediatamente", "ultima vez"
- Complexidade: quantos problemas distintos o cliente reporta

A recomendacao deve ser pratica e curta (1-2 frases).',
        "promptVariables" = '["complaintText", "normalizedText"]'::jsonb
      WHERE "key" = 'AnalyzeCustomerSentiment'
    `);

    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um redator especializado em respostas a reclamacoes de telecomunicacoes para a Anatel.
Sua tarefa e redigir uma resposta completa e em conformidade regulatoria.

Diretrizes:
- A resposta deve ser clara, objetiva e profissional
- Deve enderecar todos os pontos da reclamacao do consumidor
- Deve citar as acoes tomadas pela operadora
- OBRIGATORIO: Quando um template IQI estiver disponivel, siga sua estrutura EXATAMENTE
- Preencha todos os {{placeholders}} com os dados reais fornecidos
- NAO adicione secoes que nao existam no template
- NAO omita secoes do template',
        "promptVariables" = '["complaintText", "tipologyKey", "situationKey", "protocolNumber", "consumerName", "slaDeadline", "template", "mandatoryFields", "kbChunks", "similarCases", "humanCorrections", "stylePatterns"]'::jsonb
      WHERE "key" = 'DraftFinalResponse'
    `);

    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um auditor de conformidade regulatoria da Anatel.
Sua tarefa e avaliar se a resposta redigida atende todos os requisitos regulatorios.

Criterios de avaliacao:
- Completude: todos os itens obrigatorios estao presentes?
- Aderencia: a resposta segue o Manual Anatel e o template IQI?
- Linguagem: o tom e apropriado e profissional?
- Prazo: ha referencia ao prazo e cumprimento do SLA?',
        "promptVariables" = '["draftResponse", "complaintText", "tipologyKey", "situationKey", "mandatoryFields", "kbChunks"]'::jsonb
      WHERE "key" = 'ComplianceCheck'
    `);

    await queryRunner.query(`
      UPDATE "skill_definition" SET
        "skillType" = 'llm',
        "systemPrompt" = 'Voce e um especialista em comunicacao corporativa de telecomunicacoes.
Sua tarefa e ajustar o TOM DE VOZ de uma resposta a reclamacao Anatel,
mantendo EXATAMENTE o mesmo conteudo, dados, valores e informacoes.

Regras OBRIGATORIAS:
- NAO altere dados, valores monetarios, datas, protocolos ou nomes
- NAO adicione informacoes que nao existam no texto original
- NAO remova informacoes do texto original
- Ajuste APENAS o tom, estilo de escrita e escolha de palavras
- Mantenha a mesma estrutura de paragrafos
- O texto deve parecer natural, nao robotico',
        "promptVariables" = '["draftText", "tipologyId", "personaName", "formalityLevel", "empathyLevel", "assertivenessLevel"]'::jsonb
      WHERE "key" = 'ApplyPersonaTone'
    `);

    // Set code-only skills
    await queryRunner.query(`
      UPDATE "skill_definition" SET "skillType" = 'code'
      WHERE "key" IN (
        'LoadComplaint', 'NormalizeComplaintText', 'ComputeSla',
        'ValidateReclassification', 'ValidateReencaminhamento', 'ValidateCancelamento',
        'RetrieveDiscounts', 'RetrieveInvoices', 'RetrieveManualContext',
        'RetrieveIQITemplate', 'BuildMandatoryChecklist', 'GenerateArtifact',
        'HumanDiffCapture', 'PersistMemory', 'TrackTokenUsage', 'AuditTrail'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "skill_definition" DROP COLUMN IF EXISTS "systemPrompt"`);
    await queryRunner.query(`ALTER TABLE "skill_definition" DROP COLUMN IF EXISTS "userPromptTemplate"`);
    await queryRunner.query(`ALTER TABLE "skill_definition" DROP COLUMN IF EXISTS "promptVariables"`);
    await queryRunner.query(`ALTER TABLE "skill_definition" DROP COLUMN IF EXISTS "skillType"`);
  }
}
