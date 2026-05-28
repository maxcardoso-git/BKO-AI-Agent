import { Body, Controller, Get, Put, Request } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TurbinaPresetService } from '../services/turbina-preset.service';

@Controller('turbina/preset')
export class TurbinaPresetController {
  constructor(private readonly service: TurbinaPresetService) {}

  /** GET /api/turbina/preset — returns the saved filter selections for the
   *  current user (empty object if none). ADMIN+SUPERVISOR (same audience as
   *  /turbina UI). */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  get(@Request() req: any): Promise<Record<string, string[]>> {
    return this.service.get(req.user.id);
  }

  /** PUT /api/turbina/preset — upserts the current user's filter preset. */
  @Put()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async save(
    @Request() req: any,
    @Body() body: { filters: Record<string, string[]> },
  ): Promise<{ ok: true }> {
    await this.service.save(req.user.id, body.filters ?? {});
    return { ok: true };
  }
}
