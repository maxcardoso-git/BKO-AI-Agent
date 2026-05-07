import { Controller, Get } from '@nestjs/common';
import { TicketLockService } from '../services/ticket-lock.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TicketLock } from '../entities/ticket-lock.entity';

@Controller('admin/locks')
export class AdminLocksController {
  constructor(private readonly ticketLockService: TicketLockService) {}

  /** GET /api/admin/locks — list all active locks (SUPERVISOR/ADMIN) */
  @Get()
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  findAll(): Promise<TicketLock[]> {
    return this.ticketLockService.findAll();
  }
}
