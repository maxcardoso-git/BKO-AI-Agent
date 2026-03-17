import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import RegulatorioSeeder from './regulatorio.seeder';
import OrquestracaoSeeder from './orquestracao.seeder';
import ComplaintMockSeeder from './complaint-mock.seeder';

export default class MainSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    console.log('MainSeeder: starting all seeders...');

    await new RegulatorioSeeder().run(dataSource, factoryManager);
    await new OrquestracaoSeeder().run(dataSource, factoryManager);
    await new ComplaintMockSeeder().run(dataSource, factoryManager);

    console.log('MainSeeder: all seeders completed.');
  }
}
