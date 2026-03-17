import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { Complaint } from '../../modules/operacao/entities/complaint.entity';
import { ComplaintDetail } from '../../modules/operacao/entities/complaint-detail.entity';
import { ComplaintHistory } from '../../modules/operacao/entities/complaint-history.entity';
import { Tipology } from '../../modules/regulatorio/entities/tipology.entity';
import { Subtipology } from '../../modules/regulatorio/entities/subtipology.entity';
import { Situation } from '../../modules/regulatorio/entities/situation.entity';
import { createComplaintData } from '../factories/complaint.factory';

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default class ComplaintMockSeeder implements Seeder {
  async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const complaintRepo = dataSource.getRepository(Complaint);
    const detailRepo = dataSource.getRepository(ComplaintDetail);
    const historyRepo = dataSource.getRepository(ComplaintHistory);

    // Skip if complaints already exist (idempotency)
    const existingCount = await complaintRepo.count();
    if (existingCount >= 20) {
      console.log(
        `ComplaintMockSeeder: ${existingCount} complaints already exist, skipping.`,
      );
      return;
    }

    // Load reference data seeded by RegulatorioSeeder
    const tipologyRepo = dataSource.getRepository(Tipology);
    const subtipologyRepo = dataSource.getRepository(Subtipology);
    const situationRepo = dataSource.getRepository(Situation);

    const tipologyMap: Record<string, Tipology> = {};
    const allTipologias = await tipologyRepo.find();
    for (const t of allTipologias) {
      tipologyMap[t.key] = t;
    }

    const allSubtipologias = await subtipologyRepo.find();
    const subtipologiasByTipology: Record<string, Subtipology[]> = {};
    for (const st of allSubtipologias) {
      if (!subtipologiasByTipology[st.tipologyId]) {
        subtipologiasByTipology[st.tipologyId] = [];
      }
      subtipologiasByTipology[st.tipologyId].push(st);
    }

    const allSituations = await situationRepo.find();

    // Distribution: 6 cobranca, 5 cancelamento, 5 portabilidade, 4 qualidade = 20
    const complaintDistribution = [
      { tipologyKey: 'cobranca', count: 6 },
      { tipologyKey: 'cancelamento', count: 5 },
      { tipologyKey: 'portabilidade', count: 5 },
      { tipologyKey: 'qualidade', count: 4 },
    ];

    let index = 100001;
    const allComplaints: Complaint[] = [];

    for (const { tipologyKey, count } of complaintDistribution) {
      const tipology = tipologyMap[tipologyKey];
      if (!tipology) {
        console.warn(`Tipology '${tipologyKey}' not found, skipping.`);
        continue;
      }
      const subtipologias = subtipologiasByTipology[tipology.id] || [];

      for (let i = 0; i < count; i++) {
        const forceOverdue = i === 0; // First complaint of each tipology is overdue
        const forceHighRisk = i === 1; // Second complaint is high risk

        const subtipology =
          subtipologias.length > 0
            ? getRandomElement(subtipologias)
            : undefined;
        const situation =
          Math.random() > 0.2 ? getRandomElement(allSituations) : undefined;

        const complaintData = createComplaintData({
          tipologyId: tipology.id,
          tipologyKey,
          situationId: situation?.id,
          subtipologyId: subtipology?.id,
          forceOverdue,
          forceHighRisk,
          index,
        });

        const complaint = complaintRepo.create(complaintData);
        const saved = await complaintRepo.save(complaint);
        allComplaints.push(saved);
        index++;
      }
    }

    // Create complaint_detail records (3-5 per complaint)
    for (const complaint of allComplaints) {
      const detailCount = faker.number.int({ min: 3, max: 5 });
      const fieldSets = buildDetailFields(complaint.tipologyId ?? '', tipologyMap);
      const selectedFields = fieldSets.slice(0, detailCount);

      const details = selectedFields.map((field) =>
        detailRepo.create({
          complaintId: complaint.id,
          fieldName: field.fieldName,
          fieldValue: field.fieldValue,
          fieldType: field.fieldType,
          confidence: faker.number.float({ min: 0.7, max: 1.0, fractionDigits: 2 }),
          source: 'anatel_portal',
        }),
      );
      await detailRepo.save(details);
    }

    // Create complaint_history records (1-2 per complaint)
    for (const complaint of allComplaints) {
      const historyCount = faker.number.int({ min: 1, max: 2 });
      const histories: Partial<ComplaintHistory>[] = [];

      histories.push({
        complaintId: complaint.id,
        action: 'created',
        description: 'Reclamacao registrada via portal Anatel',
        previousStatus: null,
        newStatus: 'pending',
        performedBy: 'sistema',
      });

      if (historyCount > 1) {
        histories.push({
          complaintId: complaint.id,
          action: 'classified',
          description: `Reclamacao classificada automaticamente como ${
            allTipologias.find((t) => t.id === complaint.tipologyId)?.label ||
            'desconhecida'
          }`,
          previousStatus: 'pending',
          newStatus: complaint.status,
          performedBy: 'agente_bko',
        });
      }

      await historyRepo.save(histories);
    }

    console.log(
      `ComplaintMockSeeder: created ${allComplaints.length} complaints with details and history.`,
    );
  }
}

function buildDetailFields(
  tipologyId: string,
  tipologyMap: Record<string, Tipology>,
): Array<{ fieldName: string; fieldValue: string; fieldType: string }> {
  const tipologyKey =
    Object.entries(tipologyMap).find(([, t]) => t.id === tipologyId)?.[0] ||
    'cobranca';

  const baseFields = [
    {
      fieldName: 'nome_reclamante',
      fieldValue: faker.person.fullName(),
      fieldType: 'text',
    },
    {
      fieldName: 'cpf_reclamante',
      fieldValue: generateCpfMask(),
      fieldType: 'cpf',
    },
    {
      fieldName: 'telefone_reclamante',
      fieldValue: `(${faker.number.int({ min: 11, max: 99 })}) 9${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({ min: 1000, max: 9999 })}`,
      fieldType: 'phone',
    },
    {
      fieldName: 'email_reclamante',
      fieldValue: faker.internet.email(),
      fieldType: 'email',
    },
    {
      fieldName: 'plano_servico',
      fieldValue: faker.helpers.arrayElement([
        'Internet 200MB',
        'Internet 500MB',
        'Combo TV+NET 100MB',
        'Plano Movel Controle',
        'Plano Familia Premium',
      ]),
      fieldType: 'text',
    },
    {
      fieldName: 'uf_reclamante',
      fieldValue: faker.helpers.arrayElement([
        'SP',
        'RJ',
        'MG',
        'RS',
        'BA',
        'PR',
        'PE',
        'CE',
      ]),
      fieldType: 'text',
    },
  ];

  const tipologySpecificFields: Record<
    string,
    Array<{ fieldName: string; fieldValue: string; fieldType: string }>
  > = {
    cobranca: [
      {
        fieldName: 'valor_cobrado',
        fieldValue: faker.commerce.price({ min: 50, max: 500, dec: 2, symbol: 'R$ ' }),
        fieldType: 'currency',
      },
      {
        fieldName: 'mes_referencia',
        fieldValue: faker.date.month(),
        fieldType: 'text',
      },
    ],
    cancelamento: [
      {
        fieldName: 'data_pedido_cancelamento',
        fieldValue: faker.date.recent({ days: 60 }).toISOString().split('T')[0],
        fieldType: 'date',
      },
      {
        fieldName: 'motivo_cancelamento',
        fieldValue: faker.helpers.arrayElement([
          'Mudanca de operadora',
          'Problemas com sinal',
          'Valor alto',
          'Mudanca de cidade',
        ]),
        fieldType: 'text',
      },
    ],
    portabilidade: [
      {
        fieldName: 'numero_portabilidade',
        fieldValue: `(${faker.number.int({ min: 11, max: 99 })}) 9${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({ min: 1000, max: 9999 })}`,
        fieldType: 'phone',
      },
      {
        fieldName: 'operadora_origem',
        fieldValue: faker.helpers.arrayElement(['Claro', 'Vivo', 'TIM', 'Oi', 'Nextel']),
        fieldType: 'text',
      },
    ],
    qualidade: [
      {
        fieldName: 'tipo_problema',
        fieldValue: faker.helpers.arrayElement([
          'Lentidao de internet',
          'Queda de sinal',
          'Interrupcao total',
          'Oscilacao',
        ]),
        fieldType: 'text',
      },
      {
        fieldName: 'data_inicio_problema',
        fieldValue: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
        fieldType: 'date',
      },
    ],
  };

  const specificFields = tipologySpecificFields[tipologyKey] || [];
  return [...baseFields, ...specificFields];
}

function generateCpfMask(): string {
  const n = () => faker.number.int({ min: 0, max: 9 });
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}
