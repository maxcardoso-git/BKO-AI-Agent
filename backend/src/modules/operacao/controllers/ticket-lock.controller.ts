import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Request,
  HttpCode,
} from '@nestjs/common';
import { TicketLockService } from '../services/ticket-lock.service';
import { TimingEventService } from '../services/timing-event.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TicketLock } from '../entities/ticket-lock.entity';

@Controller('complaints/:id/lock')
export class TicketLockController {
  constructor(
    private readonly ticketLockService: TicketLockService,
    private readonly timingEventService: TimingEventService,
  ) {}

  /** GET /api/complaints/:id/lock — get current lock state */
  @Get()
  getLock(@Param('id', ParseUUIDPipe) id: string): Promise<TicketLock | null> {
    return this.ticketLockService.getLock(id);
  }

  /** POST /api/complaints/:id/lock — acquire lock */
  @Post()
  @HttpCode(200)
  acquire(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<TicketLock> {
    return this.ticketLockService.acquire(id, req.user.id);
  }

  /** PATCH /api/complaints/:id/lock/renew — renew lock expiry */
  @Patch('renew')
  @HttpCode(200)
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<TicketLock> {
    return this.ticketLockService.renew(id, req.user.id);
  }

  /** DELETE /api/complaints/:id/lock/force — force release (SUPERVISOR/ADMIN only) */
  @Delete('force')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  @HttpCode(200)
  async forceRelease(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.ticketLockService.forceRelease(id, req.user.role);
    return { success: true };
  }

  /** POST /api/complaints/:id/lock/discard — current user discards ticket back to queue */
  @Post('discard')
  @HttpCode(200)
  async discard(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    const result = await this.ticketLockService.discard(id, req.user.id);
    await this.timingEventService.emit('ticket_discarded', id, null, req.user.id);
    return result;
  }
}
