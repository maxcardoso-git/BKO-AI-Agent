import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Complaint } from './entities/complaint.entity';
import { ComplaintDetail } from './entities/complaint-detail.entity';
import { ComplaintHistory } from './entities/complaint-history.entity';
import { ComplaintAttachment } from './entities/complaint-attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Complaint,
      ComplaintDetail,
      ComplaintHistory,
      ComplaintAttachment,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class OperacaoModule {}
