import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AccessToken } from '../entities/access-token.entity';

const TOKEN_DEFAULT_TTL_DAYS = 30;

@Injectable()
export class AccessTokenService {
  constructor(
    @InjectRepository(AccessToken)
    private readonly accessTokenRepo: Repository<AccessToken>,
  ) {}

  /**
   * Generate a new opaque token for the given user.
   * Returns the created AccessToken entity (including the plain token value).
   */
  async generateForUser(userId: string): Promise<AccessToken> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_DEFAULT_TTL_DAYS);

    const entity = this.accessTokenRepo.create({
      userId,
      token,
      expiresAt,
      isActive: true,
      lastUsedAt: null,
    });
    return this.accessTokenRepo.save(entity);
  }

  /**
   * Validate an opaque token. Returns the full entity (with user relation) or null if invalid.
   * Updates lastUsedAt on success.
   */
  async validateToken(token: string): Promise<AccessToken | null> {
    const entity = await this.accessTokenRepo.findOne({
      where: { token, isActive: true },
      relations: ['user'],
    });
    if (!entity) return null;
    if (entity.expiresAt < new Date()) return null;

    // Update lastUsedAt
    await this.accessTokenRepo.update(entity.id, { lastUsedAt: new Date() });
    entity.lastUsedAt = new Date();
    return entity;
  }

  /** List all tokens (admin view). */
  async findAll(): Promise<AccessToken[]> {
    return this.accessTokenRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** Revoke a token by id. */
  async revoke(id: string): Promise<void> {
    await this.accessTokenRepo.update(id, { isActive: false });
  }
}
