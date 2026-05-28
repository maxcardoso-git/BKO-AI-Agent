import { Body, Controller, Get, HttpCode, Post, Request } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { DatabaseResetService, ResetStats } from '../services/database-reset.service';

@Controller('admin/reset')
export class DatabaseResetController {
  constructor(private readonly service: DatabaseResetService) {}

  /** GET /api/admin/reset/stats — counts of what would be wiped. ADMIN only. */
  @Get('stats')
  @Roles(UserRole.ADMIN)
  stats(): Promise<ResetStats> {
    return this.service.getStats();
  }

  /** POST /api/admin/reset/wipe — destructive. Wipes complaint + dependencies,
   *  AI memory and audit log. Requires { confirm: "APAGAR" } in body. ADMIN only. */
  @Post('wipe')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  wipe(
    @Request() req: any,
    @Body() body: { confirm: string },
  ): Promise<ResetStats> {
    return this.service.wipe(body?.confirm ?? '', req.user.id);
  }
}
