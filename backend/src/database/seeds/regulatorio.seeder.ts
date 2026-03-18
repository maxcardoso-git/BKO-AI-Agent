import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Tipology } from '../../modules/regulatorio/entities/tipology.entity';
import { Subtipology } from '../../modules/regulatorio/entities/subtipology.entity';
import { Situation } from '../../modules/regulatorio/entities/situation.entity';
import { RegulatoryAction } from '../../modules/regulatorio/entities/regulatory-action.entity';
import {
  RegulatoryRule,
  RegulatoryRuleType,
} from '../../modules/regulatorio/entities/regulatory-rule.entity';
import { ResponseTemplate } from '../../modules/regulatorio/entities/response-template.entity';
import { MandatoryInfoRule } from '../../modules/regulatorio/entities/mandatory-info-rule.entity';

export default class RegulatorioSeeder implements Seeder {
  async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    // --- Tipologias (baseadas nas Modalidades reais da Anatel) ---
    const tipologyRepo = dataSource.getRepository(Tipology);
    const tipologias = [
      { key: 'cobranca',        label: 'Cobrança',                                                                    slaBusinessDays: 10 },
      { key: 'plano_servicos',  label: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',       slaBusinessDays: 10 },
      { key: 'cancelamento',    label: 'Cancelamento',                                                                slaBusinessDays: 10 },
      { key: 'portabilidade',   label: 'Portabilidade',                                                               slaBusinessDays: 10 },
      { key: 'qualidade',       label: 'Qualidade / Reparo',                                                          slaBusinessDays: 10 },
      { key: 'atendimento',     label: 'Atendimento',                                                                 slaBusinessDays: 10 },
    ];
    await tipologyRepo.upsert(tipologias, { conflictPaths: ['key'] });

    const tipologyMap: Record<string, Tipology> = {};
    const allTipologias = await tipologyRepo.find();
    for (const t of allTipologias) {
      tipologyMap[t.key] = t;
    }

    // --- Subtipologias (baseadas nos Motivos reais da Anatel) ---
    const subtipologyRepo = dataSource.getRepository(Subtipology);
    const subtipologias = [
      // Cobrança
      { key: 'cobranca_servico_nao_contratado',  label: 'Cobrança de serviço, produto ou plano não contratado',               tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_apos_portabilidade',      label: 'Cobrança após portabilidade',                                        tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_adicional_nao_contratado',label: 'Cobrança de serviços adicionais não contratados',                    tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_sem_documento',           label: 'Atraso ou não entrega do documento de cobrança',                     tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_valor_nao_informado',     label: 'Cobrança de valores ou taxas não informadas anteriormente',          tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_apos_cancelamento',       label: 'Cobrança após cancelamento',                                         tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_multa_fidelizacao',       label: 'Cobrança indevida de multa por fidelização (multa rescisória)',      tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_valor_ja_pago',           label: 'Cobrança de valores que já foram pagos',                             tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_contestacao',             label: 'Consumidor não consegue contestar a cobrança',                       tipologyId: tipologyMap['cobranca'].id },
      { key: 'cobranca_indevida',                label: 'Cobrança indevida',                                                  tipologyId: tipologyMap['cobranca'].id },
      // Plano de Serviços
      { key: 'plano_ligacoes_inoportunas',       label: 'Recebimento inoportuno de ligações de oferta',                       tipologyId: tipologyMap['plano_servicos'].id },
      { key: 'plano_mensagens_nao_autorizadas',  label: 'Recebimento de mensagens publicitárias não autorizadas',             tipologyId: tipologyMap['plano_servicos'].id },
      { key: 'plano_inclusao_indevida',          label: 'Inclusão indevida em promoção',                                      tipologyId: tipologyMap['plano_servicos'].id },
      { key: 'plano_nao_consegue_aderir',        label: 'Não consegue aderir à promoção',                                     tipologyId: tipologyMap['plano_servicos'].id },
      { key: 'plano_servico_diferente',          label: 'Produto ou serviço fornecido diferente do que foi ofertado',         tipologyId: tipologyMap['plano_servicos'].id },
      { key: 'plano_alterado_indevidamente',     label: 'Plano de serviço alterado indevidamente pela operadora',             tipologyId: tipologyMap['plano_servicos'].id },
      // Cancelamento
      { key: 'cancelamento_linha',               label: 'Cancelamento de Linha',                                              tipologyId: tipologyMap['cancelamento'].id },
      { key: 'cancelamento_combo',               label: 'Cancelamento Combo',                                                 tipologyId: tipologyMap['cancelamento'].id },
      // Portabilidade
      { key: 'portabilidade_movel',              label: 'Portabilidade Móvel',                                                tipologyId: tipologyMap['portabilidade'].id },
      { key: 'portabilidade_fixa',               label: 'Portabilidade Fixa',                                                 tipologyId: tipologyMap['portabilidade'].id },
      // Qualidade
      { key: 'qualidade_sinal',                  label: 'Qualidade de Sinal',                                                 tipologyId: tipologyMap['qualidade'].id },
      { key: 'qualidade_internet',               label: 'Qualidade de Internet',                                              tipologyId: tipologyMap['qualidade'].id },
    ];
    await subtipologyRepo.upsert(subtipologias, { conflictPaths: ['key'] });

    // --- Situations ---
    const situationRepo = dataSource.getRepository(Situation);
    const situations = [
      {
        key: 'aberta',
        label: 'Aberta',
        slaOverrideDays: null as number | null,
      },
      { key: 'reaberta', label: 'Reaberta', slaOverrideDays: 5 },
      { key: 'vencida', label: 'Vencida', slaOverrideDays: null },
      { key: 'em_risco', label: 'Em Risco', slaOverrideDays: null },
      {
        key: 'pedido',
        label: 'Pedido de Informacao',
        slaOverrideDays: 3,
      },
    ];
    await situationRepo.upsert(situations, { conflictPaths: ['key'] });

    // --- Regulatory Actions ---
    const actionRepo = dataSource.getRepository(RegulatoryAction);
    const actions = [
      {
        key: 'responder',
        label: 'Responder',
        requiresJustification: false,
        description: 'Responder diretamente a reclamacao',
      },
      {
        key: 'reclassificar',
        label: 'Reclassificar',
        requiresJustification: true,
        description: 'Reclassificar tipologia ou situacao da reclamacao',
      },
      {
        key: 'reencaminhar',
        label: 'Reencaminhar',
        requiresJustification: true,
        description: 'Reencaminhar para area responsavel',
      },
      {
        key: 'cancelar',
        label: 'Cancelar',
        requiresJustification: true,
        description: 'Cancelar reclamacao com motivo justificado',
      },
    ];
    await actionRepo.upsert(actions, { conflictPaths: ['key'] });

    // --- Regulatory Rules ---
    const ruleRepo = dataSource.getRepository(RegulatoryRule);
    const rules = [
      {
        code: 'SLA_ABERTA_10D',
        title: 'SLA para Reclamacao Aberta',
        description:
          'Reclamacoes com situacao aberta devem ser respondidas em ate 10 dias uteis conforme Manual Anatel.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 4.2',
        ruleType: RegulatoryRuleType.SLA,
        metadata: { sla_days: 10, situation: 'aberta' },
      },
      {
        code: 'SLA_REABERTA_5D',
        title: 'SLA para Reclamacao Reaberta',
        description:
          'Reclamacoes reabertas devem ter prazo de resposta de 5 dias uteis.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 4.3',
        ruleType: RegulatoryRuleType.SLA,
        metadata: { sla_days: 5, situation: 'reaberta' },
      },
      {
        code: 'SLA_PEDIDO_3D',
        title: 'SLA para Pedido de Informacao',
        description:
          'Pedidos de informacao devem ser respondidos em ate 3 dias uteis.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 4.4',
        ruleType: RegulatoryRuleType.SLA,
        metadata: { sla_days: 3, situation: 'pedido' },
      },
      {
        code: 'MANDATORY_PROTOCOL',
        title: 'Numero de Protocolo Obrigatorio',
        description:
          'Toda resposta deve conter o numero de protocolo da reclamacao.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 5.1',
        ruleType: RegulatoryRuleType.MANDATORY_FIELD,
        metadata: { field: 'numero_protocolo' },
      },
      {
        code: 'MANDATORY_CPF',
        title: 'CPF do Reclamante Obrigatorio',
        description:
          'O CPF do reclamante deve ser registrado e validado em toda reclamacao.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 5.2',
        ruleType: RegulatoryRuleType.MANDATORY_FIELD,
        metadata: { field: 'cpf_reclamante' },
      },
      {
        code: 'MANDATORY_RESPONSE_TEXT',
        title: 'Texto de Resposta Obrigatorio',
        description:
          'A resposta deve conter texto descritivo explicando a providencia adotada.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 5.3',
        ruleType: RegulatoryRuleType.MANDATORY_FIELD,
        metadata: { field: 'providencia_adotada' },
      },
      {
        code: 'RECLASSIFICAR_JUSTIFICATIVA',
        title: 'Reclassificacao Exige Justificativa',
        description:
          'Toda reclassificacao de tipologia ou situacao deve ser acompanhada de justificativa documentada.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 6.1',
        ruleType: RegulatoryRuleType.ACTION_CONDITION,
        metadata: { action: 'reclassificar', requires_justification: true },
      },
      {
        code: 'REENCAMINHAR_DESTINATARIO',
        title: 'Reencaminhamento Exige Destinatario',
        description:
          'O reencaminhamento deve identificar explicitamente a area ou orgao destinatario.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 6.2',
        ruleType: RegulatoryRuleType.ACTION_CONDITION,
        metadata: { action: 'reencaminhar', requires_recipient: true },
      },
      {
        code: 'CANCELAR_MOTIVO',
        title: 'Cancelamento Exige Motivo',
        description:
          'O cancelamento de uma reclamacao deve ser motivado e documentado conforme regulamento.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 6.3',
        ruleType: RegulatoryRuleType.ACTION_CONDITION,
        metadata: { action: 'cancelar', requires_reason: true },
      },
      {
        code: 'BLOCK_NO_CHECKLIST',
        title: 'Bloqueio sem Checklist Completo',
        description:
          'Nao e permitido finalizar uma reclamacao sem que todos os campos obrigatorios do checklist estejam preenchidos.',
        sourceDocument: 'Manual Anatel',
        sourceSection: 'Secao 7.1',
        ruleType: RegulatoryRuleType.BLOCKING,
        metadata: { blocks_action: 'finalizar', requires_complete_checklist: true },
      },
    ];
    await ruleRepo.upsert(rules, { conflictPaths: ['code'] });

    // --- Response Templates ---
    const templateRepo = dataSource.getRepository(ResponseTemplate);
    const templates = [
      {
        name: 'Template Cobranca',
        templateContent: `Prezado(a) {{nome_reclamante}},

Em resposta a reclamacao de protocolo {{numero_protocolo}}, referente a cobranca indevida registrada em {{data_reclamacao}}, informamos:

{{providencia_adotada}}

A cobranca indevida foi {{status_cobranca}}. Caso o estorno seja aplicavel, o prazo para credito e de {{prazo_estorno}} dias uteis.

Atenciosamente,
Equipe de Atendimento BKO`,
        version: 1,
        sourceDocument: 'guia_iqi',
        tipologyId: tipologyMap['cobranca'].id,
      },
      {
        name: 'Template Cancelamento',
        templateContent: `Prezado(a) {{nome_reclamante}},

Em resposta a reclamacao de protocolo {{numero_protocolo}}, referente ao pedido de cancelamento registrado em {{data_reclamacao}}, informamos:

{{providencia_adotada}}

O cancelamento do servico {{plano_servico}} foi {{status_cancelamento}} com data efetiva em {{data_efetiva_cancelamento}}.

Atenciosamente,
Equipe de Atendimento BKO`,
        version: 1,
        sourceDocument: 'guia_iqi',
        tipologyId: tipologyMap['cancelamento'].id,
      },
      {
        name: 'Template Portabilidade',
        templateContent: `Prezado(a) {{nome_reclamante}},

Em resposta a reclamacao de protocolo {{numero_protocolo}}, referente ao pedido de portabilidade registrado em {{data_reclamacao}}, informamos:

{{providencia_adotada}}

A portabilidade do numero {{numero_telefone}} foi {{status_portabilidade}}. O prazo regulatorio para conclusao e de {{prazo_portabilidade}} dias uteis conforme Resolucao Anatel.

Atenciosamente,
Equipe de Atendimento BKO`,
        version: 1,
        sourceDocument: 'guia_iqi',
        tipologyId: tipologyMap['portabilidade'].id,
      },
      {
        name: 'Template Qualidade',
        templateContent: `Prezado(a) {{nome_reclamante}},

Em resposta a reclamacao de protocolo {{numero_protocolo}}, referente a problemas de qualidade/reparo registrados em {{data_reclamacao}}, informamos:

{{providencia_adotada}}

A ordem de servico de {{tipo_servico}} foi {{status_reparo}}. A visita tecnica foi agendada para {{data_visita}} no periodo {{periodo_visita}}.

Atenciosamente,
Equipe de Atendimento BKO`,
        version: 1,
        sourceDocument: 'guia_iqi',
        tipologyId: tipologyMap['qualidade'].id,
      },
      {
        name: 'Template Plano e Servicos',
        templateContent: `Prezado(a) {{nome_reclamante}},

Em resposta a reclamacao de protocolo {{numero_protocolo}}, referente a {{motivo_reclamacao}} registrada em {{data_reclamacao}}, informamos:

{{providencia_adotada}}

O bloqueio/ajuste solicitado foi {{status_acao}} e o prazo para conclusao total e de ate {{prazo_dias}} dias uteis a partir desta data.
Caso continue recebendo contatos indesejados dentro deste periodo, orientamos desconsiderar pois ainda estara dentro do prazo de atualizacao sistemica.

Atenciosamente,
Equipe de Atendimento BKO`,
        version: 1,
        sourceDocument: 'guia_iqi',
        tipologyId: tipologyMap['plano_servicos'].id,
      },
    ];
    // Response templates don't have a unique key column, so we delete+insert to keep idempotent
    await dataSource.query('DELETE FROM response_template');
    await templateRepo.save(templates);

    // --- Mandatory Info Rules ---
    const mandatoryRepo = dataSource.getRepository(MandatoryInfoRule);
    const mandatoryRules = [
      {
        fieldName: 'numero_protocolo',
        fieldLabel: 'Numero do Protocolo',
        description: 'Numero unico do protocolo de atendimento Anatel',
        isRequired: true,
        sortOrder: 1,
      },
      {
        fieldName: 'cpf_reclamante',
        fieldLabel: 'CPF do Reclamante',
        description: 'CPF valido do consumidor reclamante',
        validationRule: 'cpf',
        isRequired: true,
        sortOrder: 2,
      },
      {
        fieldName: 'nome_reclamante',
        fieldLabel: 'Nome do Reclamante',
        description: 'Nome completo do consumidor reclamante',
        isRequired: true,
        sortOrder: 3,
      },
      {
        fieldName: 'descricao_fato',
        fieldLabel: 'Descricao do Fato',
        description: 'Descricao detalhada do fato reclamado',
        isRequired: true,
        sortOrder: 4,
      },
      {
        fieldName: 'providencia_adotada',
        fieldLabel: 'Providencia Adotada',
        description: 'Descricao da providencia adotada pela empresa',
        isRequired: true,
        sortOrder: 5,
      },
      {
        fieldName: 'data_resolucao',
        fieldLabel: 'Data de Resolucao',
        description: 'Data em que a resolucao foi aplicada ou prevista',
        validationRule: 'date',
        isRequired: true,
        sortOrder: 6,
      },
    ];
    // Delete and re-insert for idempotency (no unique key column)
    await dataSource.query('DELETE FROM mandatory_info_rule');
    await mandatoryRepo.save(mandatoryRules);

    console.log('RegulatorioSeeder: completed successfully.');
  }
}
