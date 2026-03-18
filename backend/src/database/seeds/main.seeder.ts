import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import ComplaintMockSeeder from './complaint-mock.seeder';
import LlmModelConfigSeeder from './llm-model-config.seeder';
import OrquestracaoSeeder from './orquestracao.seeder';
import PersonaSeeder from './persona.seeder';
import RegulatorioSeeder from './regulatorio.seeder';
import UserSeeder from './user.seeder';

export default class MainSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    console.log('MainSeeder: starting all seeders...');

    await new UserSeeder().run(dataSource, factoryManager);
    await new RegulatorioSeeder().run(dataSource, factoryManager);
    await new PersonaSeeder().run(dataSource, factoryManager);
    await new OrquestracaoSeeder().run(dataSource, factoryManager);
    await new ComplaintMockSeeder().run(dataSource, factoryManager);
    await new LlmModelConfigSeeder().run(dataSource, factoryManager);

    console.log('MainSeeder: all seeders completed.');
  }
}
