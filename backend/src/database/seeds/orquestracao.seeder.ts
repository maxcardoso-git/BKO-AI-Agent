import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { SkillDefinition } from '../../modules/orquestracao/entities/skill-definition.entity';

export default class OrquestracaoSeeder implements Seeder {
  async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const skillRepo = dataSource.getRepository(SkillDefinition);

    const skills = [
      {
        key: 'LoadComplaint',
        name: 'Load Complaint',
        description:
          'Carrega os dados da reclamacao a partir do protocolo ou ID externo',
        inputSchema: { type: 'object', properties: { protocolNumber: { type: 'string' } }, required: ['protocolNumber'] },
        outputSchema: { type: 'object', properties: { complaint: { type: 'object' } }, required: ['complaint'] },
        version: '1.0.0',
      },
      {
        key: 'NormalizeComplaintText',
        name: 'Normalize Complaint Text',
        description:
          'Normaliza o texto bruto da reclamacao removendo caracteres especiais e padronizando formatacao',
        inputSchema: { type: 'object', properties: { rawText: { type: 'string' } }, required: ['rawText'] },
        outputSchema: { type: 'object', properties: { normalizedText: { type: 'string' } }, required: ['normalizedText'] },
        version: '1.0.0',
      },
      {
        key: 'ClassifyTypology',
        name: 'Classify Typology',
        description:
          'Classifica a tipologia e subtipologia da reclamacao usando LLM e regras regulatorias',
        inputSchema: { type: 'object', properties: { normalizedText: { type: 'string' } }, required: ['normalizedText'] },
        outputSchema: {
          type: 'object',
          properties: {
            tipologyKey: { type: 'string' },
            subtipologyKey: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['tipologyKey'],
        },
        version: '1.0.0',
      },
      {
        key: 'ComputeSla',
        name: 'Compute SLA',
        description:
          'Calcula o prazo SLA em dias uteis com base na tipologia e situacao da reclamacao',
        inputSchema: {
          type: 'object',
          properties: {
            tipologyKey: { type: 'string' },
            situationKey: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['tipologyKey', 'createdAt'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            slaDeadline: { type: 'string', format: 'date-time' },
            slaBusinessDays: { type: 'number' },
            isOverdue: { type: 'boolean' },
          },
          required: ['slaDeadline', 'slaBusinessDays', 'isOverdue'],
        },
        version: '1.0.0',
      },
      {
        key: 'DetermineRegulatoryAction',
        name: 'Determine Regulatory Action',
        description:
          'Determina a acao regulatoria adequada (responder, reclassificar, reencaminhar, cancelar)',
        inputSchema: {
          type: 'object',
          properties: {
            tipologyKey: { type: 'string' },
            situationKey: { type: 'string' },
            normalizedText: { type: 'string' },
          },
          required: ['tipologyKey'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            actionKey: { type: 'string' },
            justification: { type: 'string' },
          },
          required: ['actionKey'],
        },
        version: '1.0.0',
      },
      {
        key: 'RetrieveManualContext',
        name: 'Retrieve Manual Context',
        description:
          'Recupera trechos relevantes do Manual Anatel via busca semantica (RAG)',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            tipologyKey: { type: 'string' },
            topK: { type: 'number', default: 3 },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            chunks: { type: 'array', items: { type: 'object' } },
          },
          required: ['chunks'],
        },
        version: '1.0.0',
      },
      {
        key: 'RetrieveIQITemplate',
        name: 'Retrieve IQI Template',
        description:
          'Recupera o template de resposta IQI adequado para a tipologia e situacao',
        inputSchema: {
          type: 'object',
          properties: {
            tipologyKey: { type: 'string' },
            situationKey: { type: 'string' },
          },
          required: ['tipologyKey'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            templateContent: { type: 'string' },
            templateName: { type: 'string' },
          },
          required: ['templateContent'],
        },
        version: '1.0.0',
      },
      {
        key: 'BuildMandatoryChecklist',
        name: 'Build Mandatory Checklist',
        description:
          'Constroi o checklist de campos obrigatorios para a reclamacao com base nas regras regulatorias',
        inputSchema: {
          type: 'object',
          properties: {
            tipologyKey: { type: 'string' },
            situationKey: { type: 'string' },
          },
          required: ['tipologyKey'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            checklist: { type: 'array', items: { type: 'object' } },
            completionPercentage: { type: 'number' },
          },
          required: ['checklist'],
        },
        version: '1.0.0',
      },
      {
        key: 'GenerateArtifact',
        name: 'Generate Artifact',
        description:
          'Gera e persiste um artefato tipado (rascunho, checklist, analise) para o step de execucao',
        inputSchema: {
          type: 'object',
          properties: {
            artifactType: { type: 'string' },
            content: { type: 'object' },
            stepExecutionId: { type: 'string' },
          },
          required: ['artifactType', 'content', 'stepExecutionId'],
        },
        outputSchema: {
          type: 'object',
          properties: { artifactId: { type: 'string' } },
          required: ['artifactId'],
        },
        version: '1.0.0',
      },
      {
        key: 'ApplyPersonaTone',
        name: 'Apply Persona Tone',
        description:
          'Aplica o tom e persona configurada ao rascunho de resposta',
        inputSchema: {
          type: 'object',
          properties: {
            draftText: { type: 'string' },
            personaKey: { type: 'string' },
          },
          required: ['draftText'],
        },
        outputSchema: {
          type: 'object',
          properties: { adjustedText: { type: 'string' } },
          required: ['adjustedText'],
        },
        version: '1.0.0',
      },
      {
        key: 'DraftFinalResponse',
        name: 'Draft Final Response',
        description:
          'Gera o rascunho final de resposta combinando template, contexto RAG, persona e dados da reclamacao',
        inputSchema: {
          type: 'object',
          properties: {
            templateContent: { type: 'string' },
            manualChunks: { type: 'array' },
            complaintData: { type: 'object' },
            personaKey: { type: 'string' },
          },
          required: ['templateContent', 'complaintData'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            draftResponse: { type: 'string' },
            tokensUsed: { type: 'number' },
          },
          required: ['draftResponse'],
        },
        version: '1.0.0',
      },
      {
        key: 'ComplianceCheck',
        name: 'Compliance Check',
        description:
          'Verifica conformidade regulatoria do rascunho com as regras Anatel e checklist obrigatorio',
        inputSchema: {
          type: 'object',
          properties: {
            draftResponse: { type: 'string' },
            checklist: { type: 'array' },
            tipologyKey: { type: 'string' },
          },
          required: ['draftResponse', 'checklist'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            isCompliant: { type: 'boolean' },
            violations: { type: 'array', items: { type: 'string' } },
            complianceScore: { type: 'number' },
          },
          required: ['isCompliant', 'violations'],
        },
        version: '1.0.0',
      },
      {
        key: 'HumanDiffCapture',
        name: 'Human Diff Capture',
        description:
          'Captura e registra as diferencas entre o rascunho AI e a versao final aprovada pelo humano',
        inputSchema: {
          type: 'object',
          properties: {
            aiDraft: { type: 'string' },
            humanFinal: { type: 'string' },
            reviewId: { type: 'string' },
          },
          required: ['aiDraft', 'humanFinal', 'reviewId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            diffSummary: { type: 'string' },
            changesCount: { type: 'number' },
          },
          required: ['diffSummary'],
        },
        version: '1.0.0',
      },
      {
        key: 'PersistMemory',
        name: 'Persist Memory',
        description:
          'Persiste caso processado na memoria de casos para aprendizado futuro via busca por similaridade',
        inputSchema: {
          type: 'object',
          properties: {
            complaintId: { type: 'string' },
            outcome: { type: 'object' },
            feedbackScore: { type: 'number' },
          },
          required: ['complaintId', 'outcome'],
        },
        outputSchema: {
          type: 'object',
          properties: { memoryId: { type: 'string' } },
          required: ['memoryId'],
        },
        version: '1.0.0',
      },
      {
        key: 'TrackTokenUsage',
        name: 'Track Token Usage',
        description:
          'Registra consumo de tokens e custo estimado de cada chamada LLM para controle de gastos',
        inputSchema: {
          type: 'object',
          properties: {
            llmCallId: { type: 'string' },
            promptTokens: { type: 'number' },
            completionTokens: { type: 'number' },
            model: { type: 'string' },
          },
          required: ['llmCallId', 'promptTokens', 'completionTokens', 'model'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            totalTokens: { type: 'number' },
            estimatedCost: { type: 'number' },
          },
          required: ['totalTokens', 'estimatedCost'],
        },
        version: '1.0.0',
      },
      {
        key: 'AuditTrail',
        name: 'Audit Trail',
        description:
          'Registra todas as acoes no log de auditoria imutavel para rastreabilidade regulatoria',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            entityType: { type: 'string' },
            entityId: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['action', 'entityType', 'entityId'],
        },
        outputSchema: {
          type: 'object',
          properties: { auditLogId: { type: 'string' } },
          required: ['auditLogId'],
        },
        version: '1.0.0',
      },
      {
        key: 'ValidateReclassification',
        name: 'Validate Reclassification',
        description:
          'Valida se a reclassificacao de tipologia/situacao esta corretamente justificada e documentada',
        inputSchema: {
          type: 'object',
          properties: {
            originalTipologyKey: { type: 'string' },
            newTipologyKey: { type: 'string' },
            justification: { type: 'string' },
          },
          required: ['originalTipologyKey', 'newTipologyKey', 'justification'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
          },
          required: ['isValid'],
        },
        version: '1.0.0',
      },
      {
        key: 'ValidateReencaminhamento',
        name: 'Validate Reencaminhamento',
        description:
          'Valida se o reencaminhamento possui destinatario identificado e justificativa adequada',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: { type: 'string' },
            justification: { type: 'string' },
            complaintId: { type: 'string' },
          },
          required: ['recipient', 'justification', 'complaintId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
          },
          required: ['isValid'],
        },
        version: '1.0.0',
      },
      {
        key: 'ValidateCancelamento',
        name: 'Validate Cancelamento',
        description:
          'Valida se o cancelamento da reclamacao possui motivo documentado conforme regulamento Anatel',
        inputSchema: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            complaintId: { type: 'string' },
            performedBy: { type: 'string' },
          },
          required: ['reason', 'complaintId'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
          },
          required: ['isValid'],
        },
        version: '1.0.0',
      },
    ];

    await skillRepo.upsert(skills, { conflictPaths: ['key'] });

    console.log('OrquestracaoSeeder: completed successfully.');
  }
}
