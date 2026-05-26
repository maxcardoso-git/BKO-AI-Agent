import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminAuditTimingsQueryDto } from '../dto/audit-timings.dto';

@Controller('admin/audit')
@Roles(UserRole.ADMIN)
export class AdminAuditController {
  constructor(private readonly svc: AdminAuditService) {}

  /** GET /api/admin/audit/timings — per-complaint timing metrics (ADMIN only) */
  @Get('timings')
  timings(@Query() q: AdminAuditTimingsQueryDto) {
    return this.svc.list(q);
  }
}
