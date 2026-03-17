import { runSeeders } from 'typeorm-extension';
import { AppDataSource } from '../data-source';

async function main() {
  await AppDataSource.initialize();
  await runSeeders(AppDataSource);
  await AppDataSource.destroy();
  console.log('Seeding completed successfully.');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
