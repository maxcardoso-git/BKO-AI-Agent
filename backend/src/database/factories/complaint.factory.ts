import { faker } from '@faker-js/faker/locale/pt_BR';
import {
  Complaint,
  ComplaintStatus,
  ComplaintRiskLevel,
} from '../../modules/operacao/entities/complaint.entity';

let protocolCounter = 1;

const RAW_TEXT_TEMPLATES: Record<string, string[]> = {
  cobranca: [
    'Fui cobrado indevidamente pelo servico no valor de R$ {{valor}} referente ao mes de {{mes}}. Nao reconheco esta cobranca.',
    'Recebi cobranca duplicada em minha fatura. O servico {{plano}} aparece duas vezes no periodo {{mes}}.',
    'Após o cancelamento do plano continuei sendo cobrado mensalmente. Solicito estorno imediato.',
    'Cobranca indevida de taxa de adesao que nao foi informada no ato da contratacao.',
    'Minha fatura veio com valor diferente do contratado. Contratei R$ {{valor}} mas fui cobrado mais.',
  ],
  cancelamento: [
    'Solicito cancelamento do servico de internet. Ja entrei em contato por telefone mas nao foi realizado.',
    'Nao consigo cancelar meu plano combo. Fui transferido diversas vezes sem resolucao.',
    'Pedido de cancelamento de linha movel realizado ha {{dias}} dias e ate agora nao foi processado.',
    'Empresa se recusa a cancelar servico alegando multa indevida.',
    'Contrato vigente ja passou do periodo de fidelidade mas cancelamento nao e permitido pelo atendimento.',
  ],
  portabilidade: [
    'Solicitei portabilidade do numero {{numero}} ha {{dias}} dias e nao foi concluida.',
    'Portabilidade foi recusada sem justificativa plausivel.',
    'Meu numero nao foi portado no prazo regulatorio de 3 dias uteis.',
    'Portabilidade iniciada mas servico ficou indisponivel por {{dias}} dias durante o processo.',
    'Nova operadora alega que portabilidade foi negada pela operadora atual sem motivo.',
  ],
  qualidade: [
    'Sinal de internet oscilando constantemente. Velocidade muito abaixo do contratado.',
    'Servico de televisao por assinatura com falhas diarias. Tecnico solicitado nao compareceu.',
    'Sem sinal de telefone fixo ha {{dias}} dias. Nenhuma providencia tomada apos acionamento.',
    'Velocidade de internet reduzida para menos de 10% do contratado apos reclamacao anterior.',
    'Interrupcao total do servico de internet sem comunicado previo.',
  ],
};

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildRawText(tipologyKey: string): string {
  const templates = RAW_TEXT_TEMPLATES[tipologyKey] || RAW_TEXT_TEMPLATES['cobranca'];
  let text = getRandomElement(templates);
  text = text.replace('{{valor}}', faker.commerce.price({ min: 50, max: 500, dec: 2, symbol: '' }));
  text = text.replace('{{mes}}', faker.date.month());
  text = text.replace('{{plano}}', faker.helpers.arrayElement(['Plano Familia', 'Internet Turbo', 'Combo TV+NET']));
  text = text.replace('{{dias}}', String(faker.number.int({ min: 5, max: 45 })));
  text = text.replace('{{numero}}', `(${faker.number.int({ min: 11, max: 99 })}) 9${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({ min: 1000, max: 9999 })}`);
  return text;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

export interface ComplaintFactoryOptions {
  tipologyId: string;
  tipologyKey: string;
  situationId?: string;
  subtipologyId?: string;
  forceOverdue?: boolean;
  forceHighRisk?: boolean;
  index: number;
}

export function createComplaintData(options: ComplaintFactoryOptions): Partial<Complaint> {
  const {
    tipologyId,
    tipologyKey,
    situationId,
    subtipologyId,
    forceOverdue = false,
    forceHighRisk = false,
    index,
  } = options;

  const year = 2024;
  const month = faker.number.int({ min: 1, max: 12 });
  const paddedIndex = String(index).padStart(6, '0');
  const protocolNumber = `ANATEL-${year}-${paddedIndex}`;
  protocolCounter++;

  const createdAt = faker.date.between({
    from: new Date(`${year}-01-01`),
    to: new Date(`${year}-12-31`),
  });

  const slaBusinessDays = 10;
  const slaDeadline = forceOverdue
    ? addBusinessDays(createdAt, faker.number.int({ min: 1, max: 5 }))
    : addBusinessDays(createdAt, slaBusinessDays);

  const now = new Date();
  const isOverdue = forceOverdue || slaDeadline < now;

  const statuses: ComplaintStatus[] = [
    ComplaintStatus.PENDING,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.WAITING_HUMAN,
    ComplaintStatus.COMPLETED,
  ];

  const riskLevels: ComplaintRiskLevel[] = forceHighRisk
    ? [ComplaintRiskLevel.HIGH, ComplaintRiskLevel.CRITICAL]
    : [
        ComplaintRiskLevel.LOW,
        ComplaintRiskLevel.LOW,
        ComplaintRiskLevel.MEDIUM,
        ComplaintRiskLevel.HIGH,
      ];

  void month;

  return {
    protocolNumber,
    rawText: buildRawText(tipologyKey),
    status: getRandomElement(statuses),
    riskLevel: getRandomElement(riskLevels),
    source: 'anatel_portal',
    slaBusinessDays,
    slaDeadline,
    isOverdue,
    tipologyId,
    subtipologyId: subtipologyId ?? null,
    situationId: situationId ?? null,
    createdAt,
  };
}
