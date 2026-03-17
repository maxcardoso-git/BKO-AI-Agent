import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketExecution } from './entities/ticket-execution.entity';
import { StepExecution } from './entities/step-execution.entity';
import { Artifact } from './entities/artifact.entity';
import { LlmCall } from './entities/llm-call.entity';
import { TokenUsage } from './entities/token-usage.entity';
import { HumanReview } from './entities/human-review.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketExecution,
      StepExecution,
      Artifact,
      LlmCall,
      TokenUsage,
      HumanReview,
      AuditLog,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class ExecucaoModule {}
