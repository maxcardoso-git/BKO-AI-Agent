import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { ServiceType } from '../../modules/regulatorio/entities/service-type.entity';

export class ServiceTypeSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(ServiceType);

    const services: Partial<ServiceType>[] = [
      {
        key: 'celular-pos-pago',
        label: 'Celular Pós-Pago',
        description: 'Serviço de telefonia móvel pós-pago',
        parentId: null,
        isActive: true,
      },
      {
        key: 'celular-pre-pago',
        label: 'Celular Pré-Pago',
        description: 'Serviço de telefonia móvel pré-pago',
        parentId: null,
        isActive: true,
      },
    ];

    for (const s of services) {
      const exists = await repo.findOne({ where: { key: s.key } });
      if (!exists) {
        await repo.save(repo.create(s));
        console.log(`[ServiceTypeSeeder] Inserted: ${s.label}`);
      } else {
        console.log(`[ServiceTypeSeeder] Already exists: ${s.label}`);
      }
    }
  }
}
