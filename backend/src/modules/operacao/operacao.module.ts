import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Complaint } from './entities/complaint.entity';
import { ComplaintAttachment } from './entities/complaint-attachment.entity';
import { ComplaintDetail } from './entities/complaint-detail.entity';
import { ComplaintHistory } from './entities/complaint-history.entity';
import { User } from './entities/user.entity';
import { ComplaintService } from './services/complaint.service';
import { ComplaintController } from './controllers/complaint.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Complaint,
      ComplaintDetail,
      ComplaintHistory,
      ComplaintAttachment,
      User,
    ]),
  ],
  controllers: [ComplaintController],
  providers: [ComplaintService],
  exports: [TypeOrmModule],
})
export class OperacaoModule {}
