import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { ObservabilityService } from '../services/observability.service';

@Controller()
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  // ─── Admin observability dashboard endpoints ──────────────────────────────

  @Get('admin/observability/latency')
  @Roles(UserRole.ADMIN)
  getLatencyByStep() {
    return this.observabilityService.getLatencyByStep();
  }

  @Get('admin/observability/cost')
  @Roles(UserRole.ADMIN)
  getCostByTicket() {
    return this.observabilityService.getCostByTicket();
  }

  @Get('admin/observability/error-rate')
  @Roles(UserRole.ADMIN)
  getErrorRateBySkill() {
    return this.observabilityService.getErrorRateBySkill();
  }

  @Get('admin/observability/hitl-rate')
  @Roles(UserRole.ADMIN)
  getHitlRate() {
    return this.observabilityService.getHitlRate();
  }

  @Get('admin/observability/conformance')
  @Roles(UserRole.ADMIN)
  getConformanceByTipologia() {
    return this.observabilityService.getConformanceByTipologia();
  }

  @Get('admin/observability/tokens')
  @Roles(UserRole.ADMIN)
  getTokenTotals() {
    return this.observabilityService.getTokenTotals();
  }

  // ─── Trace Explorer ───────────────────────────────────────────────────────

  @Get('admin/observability/trace/:execId')
  @Roles(UserRole.ADMIN)
  getExecutionTrace(@Param('execId') execId: string) {
    return this.observabilityService.getExecutionTrace(execId);
  }

  // ─── Per-ticket execution logs ────────────────────────────────────────────
  // Accessible to admin, supervisor, and operator (operators need to see their ticket logs)

  @Get('tickets/:complaintId/logs')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  getTicketLogs(@Param('complaintId') complaintId: string) {
    return this.observabilityService.getTicketLogs(complaintId);
  }
}
