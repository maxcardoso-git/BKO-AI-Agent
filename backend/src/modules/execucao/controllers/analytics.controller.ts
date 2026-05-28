import { Controller, Get, Param, ParseUUIDPipe, Query, NotFoundException } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { AnalyticsService } from '../services/analytics.service';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** GET /api/admin/analytics/tickets — paginated table of per-ticket analyses.
   *  Filters: from/to dates, tipologyKey, decision (approved/corrected/rejected),
   *  rating (1-3), page, limit. ADMIN + SUPERVISOR. */
  @Get('tickets')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipologyKey') tipologyKey?: string,
    @Query('decision') decision?: 'approved' | 'corrected' | 'rejected',
    @Query('rating') rating?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.listTickets({
      from,
      to,
      tipologyKey,
      decision,
      rating: rating ? Number(rating) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** GET /api/admin/analytics/tickets/:id — full drill-down for a single ticket.
   *  OPERATOR can also access individual ticket detail (used by /processar to
   *  show a read-only view when the operator searches a completed protocol).
   *  The list endpoint above stays ADMIN+SUPERVISOR only. */
  @Get('tickets/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.analytics.getTicketDetail(id);
    if (!data) throw new NotFoundException(`Ticket ${id} not found`);
    return data;
  }

  /** GET /api/admin/analytics/tipologies — distinct tipologies for the filter
   *  dropdown. Returns active tipologies only. */
  @Get('tipologies')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  tipologies() {
    return this.analytics.listTipologyOptions();
  }
}
