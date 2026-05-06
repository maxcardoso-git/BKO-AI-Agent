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
import { ComplaintService } from './services/complaint.service';
import { DiscountService } from './services/discount.service';
import { InvoiceService } from './services/invoice.service';
import { ComplaintController } from './controllers/complaint.controller';
import { DiscountController } from './controllers/discount.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { AdminUsersController } from './controllers/admin-users.controller';

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
    ]),
  ],
  controllers: [ComplaintController, DiscountController, InvoiceController, AdminUsersController],
  providers: [ComplaintService, DiscountService, InvoiceService],
  exports: [TypeOrmModule],
})
export class OperacaoModule {}
