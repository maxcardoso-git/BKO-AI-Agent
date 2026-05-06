import { Controller, Get, Post, Param, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { AccessTokenService } from '../services/access-token.service';
import { AccessToken } from '../entities/access-token.entity';

@Controller('admin/access-tokens')
export class AccessTokenController {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  /** GET /api/admin/access-tokens — list all tokens */
  @Get()
  findAll(): Promise<AccessToken[]> {
    return this.accessTokenService.findAll();
  }

  /** POST /api/admin/access-tokens/:id/revoke — revoke a token */
  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.accessTokenService.revoke(id);
    return { success: true };
  }
}
