import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrquestracaoModule } from '../orquestracao/orquestracao.module';
import { OperacaoModule } from '../operacao/operacao.module';
import { IaModule } from '../ia/ia.module';
import { MemoriaModule } from '../memoria/memoria.module';
import { BaseDeConhecimentoModule } from '../base-de-conhecimento/base-de-conhecimento.module';
import { RegulatorioModule } from '../regulatorio/regulatorio.module';
import { TicketExecution } from './entities/ticket-execution.entity';
import { StepExecution } from './entities/step-execution.entity';
import { Artifact } from './entities/artifact.entity';
import { LlmCall } from './entities/llm-call.entity';
import { TokenUsage } from './entities/token-usage.entity';
import { HumanReview } from './entities/human-review.entity';
import { AuditLog } from './entities/audit-log.entity';
import { ExecutionService } from './services/execution.service';
import { TicketExecutionService } from './services/ticket-execution.service';
import { SkillRegistryService } from './services/skill-registry.service';
import { ExecutionController } from './controllers/execution.controller';
import { TicketExecutionController } from './controllers/ticket-execution.controller';

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
    IaModule,                  // provides AI agents for skill dispatch
    MemoriaModule,             // provides CaseMemory + HumanFeedbackMemory repos for PersistMemory skill
    BaseDeConhecimentoModule,  // provides VectorSearchService, TemplateResolverService, MandatoryInfoResolverService
    RegulatorioModule,         // provides Persona repo for ApplyPersonaTone skill
  ],
  controllers: [ExecutionController, TicketExecutionController],
  providers: [ExecutionService, TicketExecutionService, SkillRegistryService],
  exports: [TypeOrmModule, ExecutionService, TicketExecutionService, SkillRegistryService],
})
export class ExecucaoModule {}
