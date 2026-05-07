import { Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { AccessTokenService } from '../services/access-token.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AccessToken } from '../entities/access-token.entity';

@Controller('admin/access-tokens')
export class AccessTokenController {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  /** GET /api/admin/access-tokens — list all tokens with user relation */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(): Promise<AccessToken[]> {
    return this.accessTokenService.findAll();
  }

  /** POST /api/admin/access-tokens/generate — generate a token for a user (ADMIN only) */
  @Post('generate')
  @Roles(UserRole.ADMIN)
  generate(@Body() body: { userId: string; ttlDays?: number }): Promise<AccessToken> {
    return this.accessTokenService.generateForUser(body.userId, body.ttlDays);
  }

  /** POST /api/admin/access-tokens/:id/revoke — revoke a token */
  @Post(':id/revoke')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.accessTokenService.revoke(id);
    return { success: true };
  }
}
