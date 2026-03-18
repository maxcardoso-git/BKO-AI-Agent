import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';

export default class LlmModelConfigSeeder implements Seeder {
  async run(dataSource: DataSource, _factoryManager: SeederFactoryManager): Promise<void> {
    const repo = dataSource.getRepository('llm_model_config');

    // Check if already seeded
    const count = await repo.count();
    if (count > 0) {
      return;
    }

    // Insert default configurations
    // 1. classificacao — lighter model, low temperature
    await dataSource.query(`
      INSERT INTO "llm_model_config" ("id", "functionalityType", "provider", "modelId", "apiKeyEnvVar", "temperature", "maxTokens", "isActive")
      VALUES
        (uuid_generate_v4(), 'classificacao', 'openai', 'gpt-4o-mini', 'OPENAI_API_KEY', 0.1, 1024, true),
        (uuid_generate_v4(), 'composicao', 'openai', 'gpt-4o', 'OPENAI_API_KEY', 0.7, 4096, true),
        (uuid_generate_v4(), 'avaliacao', 'openai', 'gpt-4o-mini', 'OPENAI_API_KEY', 0.2, 2048, true),
        (uuid_generate_v4(), 'embeddings', 'openai', 'text-embedding-3-small', 'OPENAI_API_KEY', 0.0, null, true)
    `);
  }
}
