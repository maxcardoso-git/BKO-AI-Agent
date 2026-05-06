import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { User, UserRole } from '../../modules/operacao/entities/user.entity';

export default class UserSeeder implements Seeder {
  async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    const userRepo = dataSource.getRepository(User);

    const users: Partial<User>[] = [
      {
        email: 'operator@bko.ai',
        passwordHash: bcrypt.hashSync('operator123', 10),
        name: 'Ana Operadora',
        role: UserRole.OPERATOR,
      },
      {
        email: 'supervisor@bko.ai',
        passwordHash: bcrypt.hashSync('supervisor123', 10),
        name: 'Carlos Supervisor',
        role: UserRole.SUPERVISOR,
      },
      {
        email: 'admin@bko.ai',
        passwordHash: bcrypt.hashSync('admin123', 10),
        name: 'Maria Admin',
        role: UserRole.ADMIN,
      },
    ];

    await userRepo.upsert(users as any, { conflictPaths: ['email'] });

    console.log('UserSeeder: Seeded 3 users');
  }
}
