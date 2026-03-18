import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Complaint, ComplaintStatus, ComplaintRiskLevel } from '../../modules/operacao/entities/complaint.entity';
import { ComplaintHistory } from '../../modules/operacao/entities/complaint-history.entity';
import { Tipology } from '../../modules/regulatorio/entities/tipology.entity';
import { Subtipology } from '../../modules/regulatorio/entities/subtipology.entity';
import { Situation } from '../../modules/regulatorio/entities/situation.entity';

// ---------------------------------------------------------------------------
// Dados reais extraídos do arquivo Anatel — 20 reclamações TIM (Jan 2026)
// ---------------------------------------------------------------------------
const REAL_COMPLAINTS = [
  {
    protocolNumber: '202601232076530',
    externalId: '12562859',
    modalidade: 'Cobrança',
    motivo: 'Cobrança de serviço, produto ou plano não contratado',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_servico_nao_contratado',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'PR',
    clienteCidade: 'Curitiba',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'M1_SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.HIGH,
    nota: 1.941,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-27T15:59:00'),
    dataFinalizacao: new Date('2026-01-28T12:22:00'),
    protocoloPrestadora: '2026047040539',
    rawText: `Reclamação ANATEL nº: 2026047040539. Protocolo TIM nº: 2026047040539.
Registro reclamação por venda enganosa, promessa verbal não cumprida e imposição de fidelização indevida.
A contratação junto à TIM ocorreu mediante condicionamento da venda de um iPhone 16 à contratação de quatro linhas empresariais, com plano de valor elevado e prazo de permanência de 24 meses.
A decisão de contratação somente foi tomada porque o vendedor da TIM garantiu expressamente que, caso o custo mensal se tornasse inviável, seria possível realizar downgrade do plano, cancelar parte das linhas ou manter apenas uma linha em valor aproximado de R$ 100,00, sem aplicação de multa.
Após a ativação dos serviços, a TIM passou a informar que nenhuma dessas opções é permitida, e que qualquer alteração configuraria quebra de contrato com multa, o que contraria diretamente a condição apresentada no momento da venda.
Ressalto que a proposta comercial enviada pela própria TIM não reflete as condições prometidas verbalmente, evidenciando que a contratação foi realizada com base em informação enganosa que induziu o consumidor a erro.
Informo, ainda, que possuo gravação da conversa com o vendedor, na qual ficam claras as condições ofertadas quanto à possibilidade de downgrade ou cancelamento sem multa.
Solicito a intervenção da ANATEL para garantir: 1. Revisão do contrato; ou 2. Cancelamento/downgrade das linhas sem multa; ou 3. Anulação da fidelização imposta diante da oferta enganosa.`,
    resposta: `Olá, Luciano. Bom dia! Gostaríamos de esclarecer alguns pontos referentes à sua solicitação. O protocolo 2026047040539 informado nesta manifestação foi identificado como válido em nosso sistema. Após análise, identificamos que estão ativas 04 linhas vinculadas ao plano Tim Black Empresa III, no valor de R$ 99,99 por linha, com fidelização de 24 meses. Também consta ativo o parcelamento do aparelho no valor de R$ 199,66 mensais em 24 meses. Para que possamos prosseguir com o cancelamento das linhas, é necessário realizar um contato de segurança com o responsável legal da empresa para validação. Foram realizadas tentativas de contato no dia 28/01/26 sem sucesso. Informamos que as solicitações registradas sob o ID 202601232076530 foram devidamente atendidas, conforme o protocolo 2026063563194.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Cobrança após migração', motivoProblema1: 'Conta/Cobrança', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Não Resolvida', considerada: 'Procedente sem contato' },
  },
  {
    protocolNumber: '202601231915367',
    externalId: '12561306',
    modalidade: 'Cobrança',
    motivo: 'Cobrança após portabilidade',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_apos_portabilidade',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'RJ',
    clienteCidade: 'Rio de Janeiro',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Usuário WEB',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.HIGH,
    nota: 2.028,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T16:06:00'),
    dataFinalizacao: new Date('2026-01-29T14:40:00'),
    protocoloPrestadora: '2025232708997',
    rawText: `No dia 23/09/2025, solicitei a portabilidade do meu número TIM. A mesma foi concluída no dia 26/09 de manhã cedo. Após isso, não recebi mais contato da operadora até o dia 09/10/2025, quando começaram a me ligar cobrando uma fatura que não tinha recebido.
Contactei a operadora e eles falaram que não tinham mais o meu contato. Recebi a fatura referente aos dias 14/08 a 13/09. Concordei com o pagamento e paguei assim que recebi o boleto. Perguntei se tinha mais alguma obrigação financeira com a TIM e me foi informado que não.
Porém, no dia 29/09/2025 recebi a fatura referente aos dias 14/09 a 13/10, no valor integral. Considerando que utilizei os serviços da TIM apenas entre os dias 14 e 26/09, contestei a cobrança. A própria Anatel informa que nos planos Controle o valor da fatura deve ser proporcional aos dias utilizados.
Mediante a segunda contestação, a TIM abriu outro atendimento e recebi resposta com mensagem corrompida. No dia 24/11/2025, a operadora passou a me ligar abusivamente cobrando a conta contestada. Mediante coação a pagar e ameaças de negativarem meu nome, paguei a fatura mesmo sem concordar.
A empresa reconhece a cobrança indevida e afirmou que vai me reembolsar em dobro do valor em até 30 dias. Após os 30 dias, voltei a cobrar a empresa pelo reembolso, mas até agora não recebi.`,
    resposta: `Prezada Sra. Giovanna Moraes da Costa, em atenção à sua manifestação, realizamos uma análise detalhada em 29/01/2026 referente ao acesso vinculado à oferta TIM Controle Smart 9.0. Identificamos que por meio do protocolo 2025873722408, registrado em 02/12/2025, foi solicitada a devolução do valor pago a maior na fatura com vencimento em 07/01/2026, no montante de R$ 75,99. Realizamos nova solicitação de ressarcimento por meio do protocolo 2026066456808, com pedido de prioridade na tratativa. Seguiremos acompanhando a finalização desta solicitação e retornaremos contato com as devidas atualizações.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Cobrança após desativação do acesso', motivoProblema1: 'Conta/Cobrança', motivoSolucao1: 'Ressarcimento de valores', retido: 'Sim', motivoRetencao: 'cliente_ameaca_reabertura', resolvido: 'Não Resolvida', considerada: 'Procedente com contato' },
  },
  {
    protocolNumber: '202601231492816',
    externalId: '12558506',
    modalidade: 'Cobrança',
    motivo: 'Cobrança de serviços adicionais não contratados',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_adicional_nao_contratado',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'SP',
    clienteCidade: 'Osasco',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'WhatsApp',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.HIGH,
    nota: 0.699,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-26T15:55:00'),
    dataFinalizacao: new Date('2026-01-31T09:42:00'),
    protocoloPrestadora: '2025926936382',
    rawText: `Quando fiz o plano era 46 reais, e começaram a cobrar 34 reais a mais de um serviço MAX. Liguei diversas vezes e informei que desconhecia e solicitei a retirada desses valores desde novembro.
Não paguei mais a conta pedindo que fosse corrigida. Eles cortaram minha linha e internet sem eu ter utilizado o plano, sumiram com 80 reais de crédito que tinha para pacote adicional, e consta três contas de nov, dez e jan que discordo pois está cobrando esses 34 a mais.`,
    resposta: `Olá, Aline! Analisamos sua solicitação em 30/01/2026 referente ao número vinculado ao plano TIM Controle A Plus 8.0. Após análise detalhada, identificamos que o serviço MAX mensal foi cancelado em 23/01/2026. Considerando que o serviço estava ativo sem o pleno conhecimento da cliente, realizamos a isenção das faturas de vencimento 20/11/2025 (R$83,00), 20/12/2025 (R$83,21) e 20/01/2026 (R$34,90). Realizamos um crédito no valor de R$80,00 a ser descontado nas próximas faturas a partir do vencimento 20/03/2026.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Conta/Cobrança', motivoProblema2: 'Cobrança de serviços VAS', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Procedente sem contato' },
  },
  {
    protocolNumber: '202601231810645',
    externalId: '12560184',
    modalidade: 'Cobrança',
    motivo: 'Atraso ou não entrega do documento de cobrança',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_sem_documento',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'MG',
    clienteCidade: 'Belo Horizonte',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Call Center',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.MEDIUM,
    nota: 0.699,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T15:59:00'),
    dataFinalizacao: new Date('2026-01-31T12:01:00'),
    protocoloPrestadora: '2026043382725',
    rawText: `Consumidora reclama que paga para falar ilimitado e fez o plano há muitos anos, recebe o boleto todo dia 20. Estão lhe informando que tudo será digital a partir de fevereiro e que terá que efetuar o pagamento via pix, mas a mesma não possui e não deseja fazer nem deseja alterar seu plano. Acrescenta que é idosa.
Solicita o envio do boleto com urgência via correios e permanência no plano atual.`,
    resposta: `Rita de Cassia, conforme contato realizado sem sucesso via WhatsApp em 31 de janeiro de 2026, encaminhamos os esclarecimentos solicitados. Informamos que a linha permanece ativa desde 16/11/2022, vinculada ao plano TIM Controle Ligações Ilimitadas 90. Realizamos a alteração da forma de envio da fatura para correspondência via Correios no endereço cadastrado. O envio por correspondência será efetivado a partir do próximo ciclo, de 01/02 a 28/02, com vencimento em 20/03/2026. Informamos ainda que foi enviado via SMS o código de barras referente à fatura com vencimento em 20/01/2026 no valor de R$ 25,51.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Atendimento', motivoReclamacao2: 'Recebe informações divergentes no atendimento', motivoProblema1: 'Fatura', motivoProblema2: 'Não recebimento, cliente é conta online', motivoSolucao1: 'Atualização cadastral', retido: 'Sim', motivoRetencao: 'cliente_ameaca_reabertura', resolvido: 'Sem Avaliação', considerada: 'Procedente sem contato' },
  },
  {
    protocolNumber: '202601264494581',
    externalId: '12570196',
    modalidade: 'Cobrança',
    motivo: 'Cobrança de valores ou taxas não informadas anteriormente',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_valor_nao_informado',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'BA',
    clienteCidade: 'Salvador',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Call Center',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.MEDIUM,
    nota: 0.699,
    slaDeadline: new Date('2026-02-05'),
    dataCadastro: new Date('2026-01-26T16:07:00'),
    dataFinalizacao: new Date('2026-02-02T09:02:00'),
    protocoloPrestadora: '2026058098978',
    rawText: `Consumidor reclama que possui plano pós-pago com valor previamente acordado no importe de R$180,00. Porém, para utilização do serviço no exterior, foi necessário contratar pacote avulso, ocasião em que recebeu fatura no valor de R$379,00, divergente do que havia sido ajustado.
Relatando ainda que não obteve solução junto à operadora, teve dificuldades em realizar contato pelos canais de atendimento e chegou a comparecer presencialmente a uma loja física, sem resolução do problema.
Solicita que seja realizada a correção do valor cobrado, com ajuste da fatura conforme o valor acordado.`,
    resposta: `Olá, Albert! Analisamos sua solicitação em 30/01/2026 referente ao número vinculado ao plano TIM Black A 8.0. Após análise detalhada, identificamos que a fatura de vencimento 07/02/2026 foi ajustada em 27/01/2026 para o valor de R$ 189,98 e a mesma já encontra-se baixada. Não constam faturas em aberto para a linha no momento.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Plano', motivoProblema2: 'Valor diferente do contratado', motivoSolucao1: 'Esclarecimento', retido: 'Não', resolvido: 'Sem Avaliação', considerada: 'Procedente sem contato' },
  },
  {
    protocolNumber: '202601231844800',
    externalId: '12560523',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Recebimento inoportuno de ligações de oferta',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_ligacoes_inoportunas',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'RJ',
    clienteCidade: 'Rio de Janeiro',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Call Center',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.MEDIUM,
    nota: 1.136,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T16:01:00'),
    dataFinalizacao: new Date('2026-01-26T11:38:00'),
    protocoloPrestadora: null,
    rawText: `Consumidora reclama que a operadora TIM liga diariamente de forma inoportuna ofertando produtos e serviços, mesmo com cadastro ativo no Não me Perturbe o problema persiste, está sendo prejudicada.
Solicito então o bloqueio das ligações inoportunas de forma definitiva com urgência e retratação pelo ocorrido.
Telefone chamador: n/s. Tipo de ligação: Telemarketing ativo (0303). O assunto é referente ao Ato nº 13672, de 27 de setembro de 2022 da ANATEL, que trata sobre o uso do prefixo 0303.`,
    resposta: `Olá Carolina Nery de Oliveira Figueiredo, conforme contato realizado com sucesso em 26/01/2026 às 11:30 através de interação pelo WhatsApp. Informamos que no dia 26/01/2026 realizamos em sistemas o bloqueio de ligações e mensagens publicitárias originadas da TIM. O prazo para atualização e conclusão do bloqueio total é de até 30 dias. Para ligações indesejadas de outras operadoras, sugerimos cadastro no Não Me Perturbe em https://www.naomeperturbe.com.br/. Sua demanda foi registrada no protocolo interno 2026059081292.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Serviço', motivoReclamacao2: 'Recebimento de mensagens publicitárias', motivoProblema1: 'Serviços', motivoProblema2: 'Não realiza bloqueio de mensagens publicitárias', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Procedente com contato' },
  },
  {
    protocolNumber: '202601232042641',
    externalId: '12562661',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Recebimento inoportuno de ligações de oferta',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_ligacoes_inoportunas',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'SP',
    clienteCidade: 'São Bernardo do Campo',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.MEDIUM,
    nota: 1.136,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T20:00:00'),
    dataFinalizacao: new Date('2026-01-27T15:46:00'),
    protocoloPrestadora: '24012026',
    rawText: `Tenho recebido mais de 20 ligações diariamente da operadora TIM me ofertando serviços e produtos. Por diversas vezes permaneci na ligação e informei para a atendente que não tinha interesse e pedi encarecidamente que parassem de me ligar, pois as ligações estão me incomodando muito e inclusive atrapalhando no meu trabalho.
Hoje mesmo estava em reunião no trabalho e em menos de uma hora recebi 4 ligações da TIM e isso está me prejudicando muito no trabalho.
Não aguento mais essas ligações. Não tem dia e nem horário para que as ligações aconteçam, estão sendo extremamente inconvenientes. As ligações acontecem sempre de números diferentes e de outra região.
Peço que as ligações sejam suspensas imediatamente.`,
    resposta: `Hedir Roberto Marson, não identificamos protocolo de atendimento válido para esta reclamação em tela. A id 202601232042641 foi atendida através do protocolo interno 2026061796170 conforme contato via WhatsApp realizado com sucesso às 15:40 no dia 27/01/2026. Aproveito a oportunidade para lhe informar que realizamos o bloqueio do acesso realizado no dia 27/01/2026. Ressaltamos que algumas dessas mensagens têm programação prévia de envio, podendo ser que ainda receba no período de 30 dias a contar de hoje. Orientamos a realizar um cadastro no site naomeperturbe.com.br.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Serviço', motivoReclamacao2: 'Recebimento de mensagens publicitárias', motivoProblema1: 'Serviços', motivoProblema2: 'Não realiza bloqueio de mensagens publicitárias', motivoSolucao1: 'Esclarecimento', motivoSolucao2: 'Prazo bloqueio total', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Procedente com contato' },
  },
  {
    protocolNumber: '202601231808052',
    externalId: '12560143',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Recebimento inoportuno de ligações de oferta',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_ligacoes_inoportunas',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'MA',
    clienteCidade: 'Fortuna',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.MEDIUM,
    nota: 2.91,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T15:59:00'),
    dataFinalizacao: new Date('2026-01-27T15:51:00'),
    protocoloPrestadora: '0',
    rawText: `Bom dia. Operadora TIM liga toda hora importunando. A operadora teve a audácia de me ligar em seguida de uma reclamação que havia feito na ligação anterior, com a atendente, onde deixei bem claro que não gostaria de receber ligações. Alguns minutos depois eles ligaram novamente.
Quero que a operadora pare de me ligar.`,
    resposta: `Eliane Fernandes Teixeira Barbosa, não identificamos protocolo de atendimento válido para esta reclamação. A id 202601231808052 foi atendida através do protocolo interno 2026061649947 conforme contato via WhatsApp realizado com sucesso às 15:40 no dia 27/01/2026. Aproveito a oportunidade para informar que realizamos o bloqueio do acesso realizado no dia 27/01/2026. Ressaltamos que algumas mensagens têm programação prévia e pode ser que ainda receba no período de 30 dias. Orientamos a realizar cadastro no naomeperturbe.com.br.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Serviço', motivoProblema1: 'Serviços', motivoProblema2: 'Não realiza bloqueio de mensagens publicitárias', motivoSolucao1: 'Esclarecimento', motivoSolucao2: 'Prazo bloqueio total', motivoReincidente: 'Problema crônico - falha operacional', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Procedente com contato' },
  },
  {
    protocolNumber: '202601231841220',
    externalId: '12560478',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Inclusão indevida em promoção',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_inclusao_indevida',
    servicoPrincipal: 'Celular Pré-Pago',
    clienteUF: 'RJ',
    clienteCidade: 'Rio de Janeiro',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.MEDIUM,
    nota: 1.136,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T16:01:00'),
    dataFinalizacao: new Date('2026-01-28T14:12:00'),
    protocoloPrestadora: '2026054199596',
    rawText: `Hoje recebi uma notícia por SMS, sendo contratado 3 serviços que eu não tive interesse em contratar. Sem contar na quantidade de anúncios que me enviam o tempo todo.
Fiz o cancelamento mas quero deixar registrado que a empresa que me inseriu em um plano não contratado sem meu consentimento para pagar diretamente na fatura. Essa TIM não é uma empresa séria.
Quero deixar registrado que a empresa fica inserindo planos não contratados e também fica oferecendo anúncios direto sem parar.`,
    resposta: `Olá, Douglas! Recebemos sua solicitação registrada na Anatel sob o protocolo 202601231841220 e compreendemos totalmente sua insatisfação. Realizamos contato através do WhatsApp em 28/01/2026 às 08:58. Após análise, confirmamos que os serviços adicionais mencionados em sua reclamação já foram cancelados com sucesso, não havendo serviço extra ativo ou cobrança indevida vinculada à sua linha. Em relação às mensagens e ligações publicitárias, o bloqueio foi efetivado em 28/01/2026. O prazo para interrupção completa pode ser de até 30 dias. Referente à sua reclamação foi registrado protocolo 2026061532399.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Serviço', motivoReclamacao2: 'Cancelamento não efetuado', motivoReclamacao3: 'VAS - diversos', motivoProblema1: 'Serviços', motivoProblema2: 'Não reconhece Ativação-VAS - diversos', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Procedente com contato' },
  },
  {
    protocolNumber: '202601231785420',
    externalId: '12559876',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Recebimento de mensagens publicitárias não autorizadas no telefone fixo ou móvel',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_mensagens_nao_autorizadas',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'MG',
    clienteCidade: 'Belo Horizonte',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: true,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 2.91,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T12:09:00'),
    dataFinalizacao: new Date('2026-01-28T14:23:00'),
    protocoloPrestadora: '0',
    rawText: `Eu não aguento mais receber ligações da TIM o dia inteiro, já abri um chamado, melhorou, agora voltou novamente. Eu não quero receber ligações de vocês, não aguento mais. Ligam de vários números diferentes.`,
    resposta: `Jeane, aproveito a oportunidade para lhe informar que realizamos o bloqueio do envio de mensagens e ligações de ofertas via telemarketing em 28/01/2026. Sobre a reclamação registrada sob número de protocolo 2026064218010, informamos que não foi possível contato. Reforçamos a priorização do bloqueio junto aos sistemas internos e parceiros. Sua demanda foi registrada no protocolo interno 2026064218010.`,
    anatelMetadata: { situacaoFocus: 'Respondida Procedente', motivoReclamacao1: 'Serviço', motivoProblema1: 'Serviços', motivoProblema2: 'Não realiza bloqueio de mensagens publicitárias', motivoSolucao1: 'Envio para outra área', motivoSolucao2: 'DL_MKT', motivoSolucao3: 'Realizado bloqueio total', motivoReincidente: 'Reclamações com motivos diferentes', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Procedente sem contato' },
  },
  {
    protocolNumber: '202601231868626',
    externalId: '12560771',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Recebimento inoportuno de ligações de oferta',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_ligacoes_inoportunas',
    servicoPrincipal: 'Celular Pré-Pago',
    clienteUF: 'GO',
    clienteCidade: 'Anápolis',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Call Center',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 7.112,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T16:03:00'),
    dataFinalizacao: new Date('2026-01-27T21:07:00'),
    protocoloPrestadora: null,
    rawText: `Consumidor reclama que está recebendo diversas ligações de ofertas inoportunas, já entrou em contato com a operadora e não teve resolução, situação causa transtornos e está sendo prejudicado.
Solicita bloqueio imediato das ligações.`,
    resposta: `Prezado Sr. Marcelo Antonio do Prado Xavier, durante nosso atendimento em 27/01/2026 às 20h32 por meio do WhatsApp, informamos que já iniciamos as providências necessárias para impedir o envio de contatos publicitários para essa linha. O prazo para a conclusão total da exclusão é de até 30 dias. Ressaltamos que algumas mensagens enviadas pela TIM são obrigatórias por legislação e não podem ser bloqueadas. Para acompanhamento desta solicitação, foi gerado o protocolo nº 2026062498792.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Serviço', motivoProblema1: 'Serviços', motivoProblema2: 'Não realiza bloqueio de mensagens publicitárias', motivoSolucao1: 'Esclarecimento', motivoReincidente: 'Discorda do Processo', detalhamentoMotivo: 'Benefícios do plano', retido: 'Sim', motivoRetencao: 'probabilidade_nota_baixa', resolvido: 'Sem Avaliação', satisfacaoCliente: 'Não Satisfeito', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601187385477',
    externalId: '12535940',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Não consegue aderir à promoção',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_nao_consegue_aderir',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'BA',
    clienteCidade: 'Vitória da Conquista',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Reaberta',
    perfilResponsavel: 'M1_SKILL_GRE',
    situationKey: 'reaberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 9.486,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-28T11:54:00'),
    dataFinalizacao: new Date('2026-01-28T12:43:00'),
    protocoloPrestadora: '2026041419498',
    rawText: `Sou cliente da TIM e estou tentando aderir ao plano TIM Mais A 8.0, porém a operadora informa que o plano não está disponível. Ressalto que outros consumidores possuem exatamente esse plano ativo, inclusive clientes que já tiveram ou conseguiram migrar recentemente.
Não foi apresentada justificativa técnica ou comercial clara para a negativa, caracterizando tratamento desigual entre consumidores, o que vai contra o Código de Defesa do Consumidor.
Solicito que a TIM libere a adesão do meu número para o plano TIM Mais A 8.0.`,
    resposta: `Prezado Sr. Jean, conforme contato realizado em 28/01/2026 às 12:09 através do WhatsApp. Identificamos que a linha está ativa no segmento pré-pago no plano TIM Pré Top. O plano TIM Mais A 8.0 faz parte de um portfólio específico criado para atender exclusivamente clientes que integraram a TIM durante o processo de migração da antiga base da operadora Oi. Esse portfólio não está disponível para novas ativações fora desse perfil. Esta tratativa ficará registrada sobre o protocolo nº 2026063938587.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Atendimento', motivoReclamacao2: 'Recebe informações divergentes no atendimento', motivoProblema1: 'Plano', motivoProblema2: 'Mudança não realizada pelo atendimento receptivo', motivoSolucao1: 'Esclarecimento', motivoReincidente: 'Discorda do Processo', detalhamentoMotivo: 'Benefícios do plano', retido: 'Sim', motivoRetencao: 'probabilidade_nota_baixa', resolvido: 'Sem Avaliação', satisfacaoCliente: 'Não Satisfeito', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601231734527',
    externalId: '12559221',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Não consegue aderir à promoção',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_nao_consegue_aderir',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'RJ',
    clienteCidade: 'São Gonçalo',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 7.112,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T12:04:00'),
    dataFinalizacao: new Date('2026-01-28T14:40:00'),
    protocoloPrestadora: '20265348765390',
    rawText: `Sou cliente da TIM há longa data e contratei um plano que me foi ofertado com a promessa de ligações ilimitadas para qualquer operadora, em âmbito nacional. Contudo, verifico que o plano disponibiliza apenas 550 minutos, em desacordo com o que foi ofertado no momento da contratação.
Além disso, foi informado que o WhatsApp seria ilimitado, porém tal benefício não está sendo concedido conforme anunciado, restringindo-se apenas a mensagens de texto e fotos, sem contemplar chamadas de voz ou vídeo.
Da mesma forma, na contratação da franquia de dados, foi garantido que o plano contaria com 60 GB de internet, o que também não vem sendo observado. Ademais, estão sendo realizadas cobranças com valores superiores aos contratados.
Solicito, em esfera administrativa, a imediata regularização do meu plano com o cumprimento integral das condições ofertadas, bem como a adequação do valor cobrado ao que foi originalmente contratado.`,
    resposta: `Vinicius, referente à reclamação registrada, o contato foi realizado com sucesso via WhatsApp em 27/01/2026 às 13h53. Informamos que sua linha está recebendo dois bônus de internet de 40GB Promo e 10 GB bônus 12M, que somados à franquia do plano de 3,5GB totalizam 53,5GB mensais. Esses bônus foram ativados em 14/01/2026 e serão liberados mensalmente até 14/01/2027. Quanto ao valor, conforme ofertado, será aplicado um desconto de R$39,00 onde sua mensalidade será de R$44,99 a partir do vencimento 07/03/2026. Este atendimento foi registrado sob o protocolo nº 2026064179938.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Voz/Dados', motivoReclamacao2: 'Falha no funcionamento do serviço', motivoProblema1: 'Dados e Voz móvel', motivoSolucao1: 'Esclarecimento', motivoReincidente: 'Reclamações com motivos diferentes', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Resolvida', satisfacaoCliente: 'Satisfeito', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601231723957',
    externalId: '12559112',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Produto ou serviço fornecido diferente do que foi ofertado pela operadora',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_servico_diferente',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'BA',
    clienteCidade: 'Feira de Santana',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Call Center',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.346,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T12:03:00'),
    dataFinalizacao: new Date('2026-01-29T10:41:00'),
    protocoloPrestadora: '2026053814534',
    rawText: `Consumidor reclama que, após alteração no valor do plano para R$ 60,00, a operadora prometeu aumento de gigas para 25 gigas no mês de janeiro, porém não disponibilizou o serviço. Consumidor realizou contato e foi informado que caso queira aderir aos 25 gigas será necessário troca de plano com perda dos streaming que fazem parte do seu plano.
Solicita disponibilidade do serviço conforme lhe foi ofertado, sem a perda de nenhum serviço.`,
    resposta: `Prezado Sr. Cristiano, bom dia! Informamos que realizamos uma análise detalhada em 29/01/26 referente ao acesso vinculado à oferta TIM Beta Mês. O referido acesso conta com 10 GB de internet disponíveis. Foram realizados ressarcimentos nos valores de R$ 102,46 e R$ 82,45. Para usufruir de benefícios superiores, orientamos sobre a possibilidade de ativação da oferta TIM Beta Lab+ Mensal Digital 3.0, que contempla 20 GB + 8 GB de apps + internet ilimitada na madrugada. No entanto, o senhor informou que não deseja realizar a ativação da oferta no momento. A manifestação registrada sob o ID 202601231723957 foi tratada por meio do protocolo interno TIM 2026066192824.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'BETA', motivoReclamacao2: 'Alteração dos pacotes de internet', motivoProblema1: 'Tim Beta', motivoProblema2: 'Cliente não é BETA LAB', motivoSolucao1: 'Esclarecimento', motivoSolucao2: 'Crédito de relacionamento', retido: 'Sim', motivoRetencao: 'cliente_ameaca_reabertura', resolvido: 'Sem Avaliação', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601231743253',
    externalId: '12559318',
    modalidade: 'Plano de Serviços, Oferta, Bônus, Promoções e Mensagens Publicitárias',
    motivo: 'Plano de serviço alterado indevidamente pela operadora',
    tipologyKey: 'plano_servicos',
    subtipologyKey: 'plano_alterado_indevidamente',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'GO',
    clienteCidade: 'Aparecida de Goiânia',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Usuário WEB',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_GRE',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.346,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T12:05:00'),
    dataFinalizacao: new Date('2026-01-29T13:09:00'),
    protocoloPrestadora: '2026053823514',
    rawText: `A operadora de telefonia celular TIM alterou meu plano TIM CONTROLE 1.0 para o TIM CONTROLE 2.0 sem o meu consentimento. Realizei a portabilidade da operadora Claro para a TIM em 21/07/2025, ocasião em que aderi ao plano TIM CONTROLE 1.0, com fidelização pelo período de 12 meses.
No entanto, posteriormente recebi uma mensagem da operadora informando a alteração unilateral do plano. Em 29/12/2025, entrei em contato com a TIM para informar que não tenho interesse na mudança, uma vez que o novo plano não oferece benefícios adicionais, apenas aumento no valor da fatura.
Desde então, tentei diversas vezes contato com a Ouvidoria da TIM (0800 882 0041), porém não obtive atendimento.
Não tenho interesse em aderir a qualquer outro plano da TIM. Ressalto ainda que no próprio site da TIM o plano TIM CONTROLE 1.0 continua sendo ofertado pelo mesmo valor para novos assinantes, o que reforça a irregularidade da alteração realizada.`,
    resposta: `Prezado Sr. Elivaldo, bom tarde. Informamos que realizamos uma análise em 29/01/26 do acesso atualmente ativo no plano TIM Controle 2.0, cujo valor real é R$ 94,99. Esclarecemos que a atualização no valor do plano decorre do reajuste anual previsto na Resolução 765/2023 da Anatel, que estabelece que as ofertas de serviços estão sujeitas a atualização conforme os índices oficiais aplicáveis. No dia 29/01/26, ativamos um desconto de R$6,00 sem fidelidade para que o valor final do plano passe a ser R$58,99 a partir da fatura com vencimento em 12/03/26. ID 202601231743253 foi tratada por meio do protocolo interno TIM 2026066627454.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Plano', motivoReclamacao2: 'Mudança de plano não solicitada', motivoProblema1: 'Plano', motivoProblema2: 'Valor diferente do contratado - Price up', motivoSolucao1: 'Esclarecimento', motivoSolucao2: 'Crédito de relacionamento', retido: 'Sim', motivoRetencao: 'cliente_ameaca_reabertura', resolvido: 'Sem Avaliação', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601231769597',
    externalId: '12559652',
    modalidade: 'Cobrança',
    motivo: 'Cobrança após portabilidade',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_apos_portabilidade',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'SC',
    clienteCidade: 'Joinville',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Usuário WEB',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.2,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T12:07:00'),
    dataFinalizacao: new Date('2026-01-23T20:13:00'),
    protocoloPrestadora: '2026053956711',
    rawText: `Eu tinha um plano da TIM e fiz portabilidade para a Vivo no dia 10/12. Recebi uma cobrança de valor cheio com vencimento em 20/01.
Em contato por duas vezes com atendentes da TIM, me informaram que essa cobrança se refere aos serviços do mês de janeiro. Informei que não faz sentido me cobrarem o mês cheio de janeiro sendo que fiquei como cliente TIM somente até o dia 10/12.
Os atendentes me informaram que não poderiam fazer nada, pois o meu plano era controle e "não tem como cobrar proporcional". Falei que isso não seria legal, mas mesmo assim não tive solução.
Não me nego a pagar pelos dias até a portabilidade, mas pagar o mês cheio não faz nenhum sentido. Gostaria de receber uma cobrança correta referente aos dias utilizados.`,
    resposta: `Prezado Eduardo Vicente dos Santos, em atenção à sua solicitação, realizamos em 23/01/2026 uma análise detalhada referente ao número vinculado ao plano TIM Controle Redes Sociais 9.0. Identificamos que a linha foi direcionada para a operadora VIVO com solicitação registrada em 28/11/2025 e conclusão em 09/12/2025, data em que o plano foi encerrado. A fatura relacionada corresponde ao vencimento de 20/01/2026 no valor de R$ 72,99 referente ao período de utilização entre 01/12 e 09/12. Em 23/01/2026, foi concedida a isenção integral dessa fatura registrada no protocolo 2026055273376.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Conta/Cobrança', motivoProblema2: 'Juros e Multas (atraso pagamento)', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', seloGovBR: 'Ouro', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601231823330',
    externalId: '12560301',
    modalidade: 'Cobrança',
    motivo: 'Cobrança após cancelamento',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_apos_cancelamento',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'CE',
    clienteCidade: 'Jaguaribara',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Usuário WEB',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.2,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T16:00:00'),
    dataFinalizacao: new Date('2026-01-26T16:31:00'),
    protocoloPrestadora: '2025843702279',
    rawText: `Boa tarde Senhores! Peço por gentileza junto ao TIM BRASIL a isenção de cobrança da linha pois a mesma foi migrada para CNPJ, ou seja, continuo na operadora e a PF continua cobrando sem existir uso após já ter sido cancelado o plano. Certo da solução, agradeço e aguardo!`,
    resposta: `Prezado Joaquim Janaldo Alves Moreira, em atenção à sua solicitação, realizamos em 26/01/2026 uma análise detalhada referente ao número vinculado ao plano TIM Black C Light 8.0. Identificamos que a linha foi direcionada para a operadora CLARO em 02/12/2025. A portabilidade concluída gerou a cobrança proporcional referente à fidelização no valor de R$ 342,99. Em 26/01/2025, foi concedida a isenção integral das faturas mencionadas, registrada nos protocolos 2026059443739 e 2026059440192. Confirmamos que não há pendências financeiras associadas à linha informada.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Conta/Cobrança', motivoProblema2: 'Juros e Multas (atraso pagamento)', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601231861398',
    externalId: '12560703',
    modalidade: 'Cobrança',
    motivo: 'Cobrança indevida de multa por fidelização (multa rescisória)',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_multa_fidelizacao',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'SP',
    clienteCidade: 'São Bernardo do Campo',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Usuário WEB',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.2,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T16:02:00'),
    dataFinalizacao: new Date('2026-01-26T16:46:00'),
    protocoloPrestadora: '2026054343448',
    rawText: `Contratei um plano da TIM em loja física e, antes de fechar, informei claramente que pretendia cancelar em 3 ou 4 meses.
A atendente da loja me garantiu que não haveria multa e que o cancelamento seria simples. Com base nessa informação, aceitei o plano.
Ao solicitar o cancelamento, fui surpreendida com uma multa de R$190 por fidelidade, informação que não foi esclarecida no momento da contratação.
Solicito a retirada da multa por falha na informação e prática abusiva, conforme o Código de Defesa do Consumidor.`,
    resposta: `Prezada Camilly da Silva Alves Machado, em atenção à sua solicitação, realizamos em 26/01/2026 uma análise detalhada referente à linha vinculada à oferta TIM Controle 2.0. Identificamos que havia um benefício fidelizado ativado em 26/09/2025 com vigência de 12 meses. Em 26/01/2026, realizamos a isenção da fidelização no valor de R$ 192,00, registrada sob o protocolo 2026059470519. A manifestação sob o ID 202601231861398 foi tratada por meio do protocolo interno 2026059480187.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Conta/Cobrança', motivoProblema2: 'Multa contratual - cliente ciente', motivoSolucao1: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', seloGovBR: 'Prata', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601232007319',
    externalId: '12562336',
    modalidade: 'Cobrança',
    motivo: 'Cobrança de valores que já foram pagos',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_valor_ja_pago',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'RJ',
    clienteCidade: 'Rio de Janeiro',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Usuário WEB',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_CONTAS_POS',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.2,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-23T19:58:00'),
    dataFinalizacao: new Date('2026-01-27T16:13:00'),
    protocoloPrestadora: '2026033086405',
    rawText: `Fiz o pagamento da fatura via pix, logo depois foi descontado o mesmo valor do débito automático, gerando duplicidade. Então liguei na central, solicitei o estorno do valor, fui informado que deveria aguardar 7 dias úteis. Já se passou o tempo e até então não tive o estorno do meu valor!`,
    resposta: `Esclarecemos que após análise realizada em 27/01/2026 junto ao acesso reclamado, consta no sistema que em 12/01/2026 foi identificado o pagamento em duplicidade da fatura de vencimento 10/01/2026 valor de R$57,99, com isso foi gerada uma Nota de Crédito para a próxima Conta. Identificamos o protocolo 2026033086405 aberto na Central para devolução em Conta corrente. Como o setor responsável não conseguiu contato para confirmação de dados, a reclamação foi encerrada. Em caráter de exceção, realizamos a baixa total da fatura 10/02/2026 R$57,99.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Conta/Cobrança', motivoProblema2: 'Alteração de vencimento, não informa cobrança de duas faturas', motivoSolucao1: 'Contestação de valores', motivoSolucao2: 'Esclarecimento', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', seloGovBR: 'Ouro', considerada: 'Improcedente com contato' },
  },
  {
    protocolNumber: '202601232203031',
    externalId: '12563324',
    modalidade: 'Cobrança',
    motivo: 'Consumidor não consegue contestar a cobrança',
    tipologyKey: 'cobranca',
    subtipologyKey: 'cobranca_contestacao',
    servicoPrincipal: 'Celular Pós-Pago',
    clienteUF: 'PR',
    clienteCidade: 'Imbaú',
    clienteTipoPessoa: 'PF',
    canalEntrada: 'Mobile App',
    acao: 'Nova',
    perfilResponsavel: 'SKILL_SQUAD',
    situationKey: 'aberta',
    procedente: false,
    riskLevel: ComplaintRiskLevel.LOW,
    nota: 4.2,
    slaDeadline: new Date('2026-02-02'),
    dataCadastro: new Date('2026-01-26T15:57:00'),
    dataFinalizacao: new Date('2026-01-28T08:09:00'),
    protocoloPrestadora: '2026047076016',
    rawText: `Boa noite, minha fatura da TIM está acima do valor que eu contratei. Contratei um valor e agora está vindo outro valor. Todo mês a mesma coisa. Preciso de ajuda. A TIM não entrou em contato para resolver. Preciso de ajuda.`,
    resposta: `Jalni Machado, em atenção à sua solicitação, realizamos em 27/01/2026 uma análise completa referente ao número vinculado ao plano TIM Black 10. O plano TIM Black 10 possui valor original de R$179,99. Em 18/12/2025 foram aplicados dois benefícios: um desconto especial no valor de R$70,00 com vigência até 18/12/2026 e o desconto Desc Basic no valor de R$10,00, resultando em valor mensal ajustado para R$99,99. Realizamos o ajuste da fatura com vencimento em 20/01/2026 para o valor de R$96,26. A manifestação de ID 202601232203031 foi concluída pelo protocolo interno 2026063372257.`,
    anatelMetadata: { situacaoFocus: 'Respondida Improcedente', motivoReclamacao1: 'Conta', motivoReclamacao2: 'Ações de cobrança', motivoProblema1: 'Conta/Cobrança', motivoProblema2: 'Juros e Multas (atraso pagamento)', motivoSolucao1: 'Esclarecimento', motivoReincidente: 'Reclamações com motivos diferentes', retido: 'Sim', motivoRetencao: 'estrategia_de_input', resolvido: 'Sem Avaliação', considerada: 'Improcedente com contato' },
  },
];

export default class ComplaintMockSeeder implements Seeder {
  async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const complaintRepo = dataSource.getRepository(Complaint);
    const historyRepo = dataSource.getRepository(ComplaintHistory);

    // Limpar reclamações mock existentes para carregar dados reais
    console.log('ComplaintMockSeeder: limpando reclamações existentes...');
    await dataSource.query('DELETE FROM complaint_history');
    await dataSource.query('DELETE FROM complaint_detail');
    await dataSource.query('DELETE FROM complaint_attachment');
    await dataSource.query('DELETE FROM complaint');

    // Carregar referências regulatórias
    const tipologyRepo = dataSource.getRepository(Tipology);
    const subtipologyRepo = dataSource.getRepository(Subtipology);
    const situationRepo = dataSource.getRepository(Situation);

    const tipologyMap: Record<string, Tipology> = {};
    for (const t of await tipologyRepo.find()) {
      tipologyMap[t.key] = t;
    }

    const subtipologyMap: Record<string, Subtipology> = {};
    for (const st of await subtipologyRepo.find()) {
      subtipologyMap[st.key] = st;
    }

    const situationMap: Record<string, Situation> = {};
    for (const s of await situationRepo.find()) {
      situationMap[s.key] = s;
    }

    const savedComplaints: Complaint[] = [];

    for (const data of REAL_COMPLAINTS) {
      const tipology = tipologyMap[data.tipologyKey];
      const subtipology = subtipologyMap[data.subtipologyKey];
      const situation = situationMap[data.situationKey];

      if (!tipology) {
        console.warn(`Tipology not found: ${data.tipologyKey} — skipping ${data.protocolNumber}`);
        continue;
      }

      const complaint = complaintRepo.create({
        protocolNumber: data.protocolNumber,
        externalId: data.externalId,
        rawText: data.rawText,
        status: ComplaintStatus.PENDING,
        riskLevel: data.riskLevel,
        slaDeadline: data.slaDeadline,
        slaBusinessDays: 10,
        isOverdue: true, // todos os prazos (fev/2026) já venceram (hoje: mar/2026)
        source: 'anatel_portal',
        procedente: data.procedente,
        modalidade: data.modalidade,
        motivo: data.motivo,
        servicoPrincipal: data.servicoPrincipal,
        canalEntrada: data.canalEntrada,
        acao: data.acao,
        perfilResponsavel: data.perfilResponsavel,
        resposta: data.resposta,
        clienteUF: data.clienteUF,
        clienteCidade: data.clienteCidade,
        clienteTipoPessoa: data.clienteTipoPessoa,
        nota: data.nota,
        protocoloPrestadora: data.protocoloPrestadora ?? null,
        dataCadastro: data.dataCadastro,
        dataFinalizacao: data.dataFinalizacao,
        anatelMetadata: data.anatelMetadata as Record<string, unknown>,
        tipologyId: tipology?.id ?? null,
        subtipologyId: subtipology?.id ?? null,
        situationId: situation?.id ?? null,
      });

      const saved = await complaintRepo.save(complaint);
      savedComplaints.push(saved);

      // Histórico: criação
      await historyRepo.save(historyRepo.create({
        complaintId: saved.id,
        action: 'created',
        description: `Reclamação ${data.acao === 'Reaberta' ? 'reaberta' : 'registrada'} via portal Anatel. Canal: ${data.canalEntrada}. Perfil: ${data.perfilResponsavel}.`,
        previousStatus: null,
        newStatus: 'pending',
        performedBy: 'sistema',
        metadata: { anatelProtocolo: data.protocolNumber, canalEntrada: data.canalEntrada },
      }));
    }

    console.log(`ComplaintMockSeeder: ${savedComplaints.length} reclamações reais carregadas.`);
    console.log(`  - Cobrança: ${savedComplaints.filter(c => c.modalidade === 'Cobrança').length}`);
    console.log(`  - Plano/Serviços: ${savedComplaints.filter(c => c.modalidade?.startsWith('Plano')).length}`);
    console.log(`  - Procedentes: ${savedComplaints.filter(c => c.procedente === true).length}`);
    console.log(`  - Improcedentes: ${savedComplaints.filter(c => c.procedente === false).length}`);
  }
}
