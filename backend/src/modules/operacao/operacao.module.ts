import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Complaint } from './entities/complaint.entity';
import { ComplaintAttachment } from './entities/complaint-attachment.entity';
import { ComplaintDetail } from './entities/complaint-detail.entity';
import { ComplaintHistory } from './entities/complaint-history.entity';
import { User } from './entities/user.entity';
import { Discount } from './entities/discount.entity';
import { Invoice } from './entities/invoice.entity';
import { ComplaintUserNote } from './entities/complaint-user-note.entity';
import { AccessToken } from './entities/access-token.entity';
import { TicketLock } from './entities/ticket-lock.entity';
import { TicketTimingEvent } from './entities/ticket-timing-event.entity';
import { Tipology } from '../regulatorio/entities/tipology.entity';
import { ComplaintService } from './services/complaint.service';
import { DiscountService } from './services/discount.service';
import { InvoiceService } from './services/invoice.service';
import { TimingEventService } from './services/timing-event.service';
import { AccessTokenService } from './services/access-token.service';
import { TicketLockService } from './services/ticket-lock.service';
import { ComplaintUserNoteService } from './services/complaint-user-note.service';
import { ComplaintController } from './controllers/complaint.controller';
import { DiscountController } from './controllers/discount.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AccessTokenController } from './controllers/access-token.controller';
import { TicketLockController } from './controllers/ticket-lock.controller';
import { ComplaintUserNoteController } from './controllers/complaint-user-note.controller';
import { AdminLocksController } from './controllers/admin-locks.controller';
import { TurbinaImportService } from './services/turbina-import.service';
import { TurbinaImportController } from './controllers/turbina-import.controller';
import { IaModule } from '../ia/ia.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Complaint,
      ComplaintDetail,
      ComplaintHistory,
      ComplaintAttachment,
      User,
      Discount,
      Invoice,
      ComplaintUserNote,
      AccessToken,
      TicketLock,
      TicketTimingEvent,
      Tipology,
    ]),
    IaModule,
  ],
  controllers: [ComplaintController, DiscountController, InvoiceController, AdminUsersController, AccessTokenController, TicketLockController, ComplaintUserNoteController, AdminLocksController, TurbinaImportController],
  providers: [ComplaintService, DiscountService, InvoiceService, TimingEventService, AccessTokenService, TicketLockService, ComplaintUserNoteService, TurbinaImportService],
  exports: [TypeOrmModule, TimingEventService, AccessTokenService],
})
export class OperacaoModule {}
