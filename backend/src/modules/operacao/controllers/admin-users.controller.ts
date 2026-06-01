import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/user.entity';
import { AccessTokenService } from '../services/access-token.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller()
export class AdminUsersController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly accessTokenService: AccessTokenService,
  ) {}

  @Get('admin/users')
  @Roles(UserRole.ADMIN)
  async listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.userRepo.find({ order: { name: 'ASC' } });
    return users.map(({ passwordHash: _, ...u }) => u);
  }

  @Post('admin/users')
  @Roles(UserRole.ADMIN)
  async createUser(
    @Body() body: { name: string; email: string; password: string; role?: string },
  ): Promise<Omit<User, 'passwordHash'>> {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = this.userRepo.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: (body.role as UserRole) ?? UserRole.OPERATOR,
      isActive: true,
    });
    const saved = await this.userRepo.save(user);
    // Auto-generate opaque access token for the new user
    await this.accessTokenService.generateForUser(saved.id);
    const { passwordHash: _, ...result } = saved;
    return result;
  }

  @Patch('admin/users/:id')
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Partial<{ name: string; email: string; password: string; role: string; isActive: boolean }>,
  ): Promise<Omit<User, 'passwordHash'>> {
    const update: Partial<User> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.email !== undefined) update.email = body.email;
    if (body.role !== undefined) update.role = body.role as UserRole;
    if (body.isActive !== undefined) update.isActive = body.isActive;
    if (body.password) update.passwordHash = await bcrypt.hash(body.password, 10);
    await this.userRepo.update(id, update);
    const user = await this.userRepo.findOneOrFail({ where: { id } });
    const { passwordHash: _, ...result } = user;
    return result;
  }

  @Delete('admin/users/:id')
  @Roles(UserRole.ADMIN)
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.userRepo.delete(id);
    return { success: true };
  }

  // ─── Webhooks (stub — sem tabela dedicada ainda) ──────────────────────────

  @Get('admin/webhooks')
  listWebhooks(): [] {
    return [];
  }

  @Get('admin/webhooks/:id/logs')
  listWebhookLogs(): [] {
    return [];
  }
}
