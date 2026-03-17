import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrquestracaoModule } from '../orquestracao/orquestracao.module';
import { OperacaoModule } from '../operacao/operacao.module';
import { TicketExecution } from './entities/ticket-execution.entity';
import { StepExecution } from './entities/step-execution.entity';
import { Artifact } from './entities/artifact.entity';
import { LlmCall } from './entities/llm-call.entity';
import { TokenUsage } from './entities/token-usage.entity';
import { HumanReview } from './entities/human-review.entity';
import { AuditLog } from './entities/audit-log.entity';
import { ExecutionService } from './services/execution.service';
import { TicketExecutionService } from './services/ticket-execution.service';
import { ExecutionController } from './controllers/execution.controller';

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
    OrquestracaoModule,
    OperacaoModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService, TicketExecutionService],
  exports: [TypeOrmModule, ExecutionService, TicketExecutionService],
})
export class ExecucaoModule {}
