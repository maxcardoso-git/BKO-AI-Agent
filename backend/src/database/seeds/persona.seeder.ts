import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { Persona } from '../../modules/regulatorio/entities/persona.entity';
import { Tipology } from '../../modules/regulatorio/entities/tipology.entity';

export default class PersonaSeeder implements Seeder {
  async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const tipologyRepo = dataSource.getRepository(Tipology);
    const personaRepo = dataSource.getRepository(Persona);

    // Skip if personas already seeded
    const existingCount = await personaRepo.count();
    if (existingCount >= 4) {
      console.log('PersonaSeeder: skipped (already seeded).');
      return;
    }

    const tipologyMap: Record<string, Tipology> = {};
    const allTipologias = await tipologyRepo.find();
    for (const t of allTipologias) {
      tipologyMap[t.key] = t;
    }

    const personas = [
      {
        name: 'Cobranca Objetiva',
        description: 'Persona para reclamacoes de cobranca — tom objetivo e direto, foco em resolucao financeira',
        formalityLevel: 4,
        empathyLevel: 2,
        assertivenessLevel: 4,
        requiredExpressions: [
          'Informamos que',
          'Atenciosamente',
        ],
        forbiddenExpressions: [
          'infelizmente',
          'lamentamos profundamente',
        ],
        isActive: true,
        tipologyId: tipologyMap['cobranca']?.id ?? null,
      },
      {
        name: 'Cancelamento Defensavel',
        description: 'Persona para reclamacoes de cancelamento — tom defensavel e documentado, justificativa clara',
        formalityLevel: 4,
        empathyLevel: 3,
        assertivenessLevel: 3,
        requiredExpressions: [
          'Conforme solicitado',
          'Atenciosamente',
        ],
        forbiddenExpressions: [
          'nao podemos',
          'impossivel',
        ],
        isActive: true,
        tipologyId: tipologyMap['cancelamento']?.id ?? null,
      },
      {
        name: 'Portabilidade Explicativa',
        description: 'Persona para reclamacoes de portabilidade — tom explicativo e detalhado, esclarece prazos e processos',
        formalityLevel: 3,
        empathyLevel: 3,
        assertivenessLevel: 3,
        requiredExpressions: [
          'Esclarecemos que',
          'Atenciosamente',
        ],
        forbiddenExpressions: [
          'voce deveria',
          'sua culpa',
        ],
        isActive: true,
        tipologyId: tipologyMap['portabilidade']?.id ?? null,
      },
      {
        name: 'Qualidade Empatica',
        description: 'Persona para reclamacoes de qualidade — tom empatico e acolhedor, reconhece inconveniente',
        formalityLevel: 3,
        empathyLevel: 5,
        assertivenessLevel: 2,
        requiredExpressions: [
          'Compreendemos o inconveniente',
          'Atenciosamente',
        ],
        forbiddenExpressions: [
          'isso e normal',
          'nao ha problema',
        ],
        isActive: true,
        tipologyId: tipologyMap['qualidade']?.id ?? null,
      },
    ];

    await personaRepo.save(personas);
    console.log('PersonaSeeder: 4 personas created successfully.');
  }
}
