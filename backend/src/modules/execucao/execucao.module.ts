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
import { Tipology } from '../regulatorio/entities/tipology.entity';
import { ResponseTemplate } from '../regulatorio/entities/response-template.entity';
import { Complaint } from '../operacao/entities/complaint.entity';
import { TicketLock } from '../operacao/entities/ticket-lock.entity';
import { ComplaintUserNote } from '../operacao/entities/complaint-user-note.entity';
import { ExecutionService } from './services/execution.service';
import { TicketExecutionService } from './services/ticket-execution.service';
import { SkillRegistryService } from './services/skill-registry.service';
import { HumanReviewService, HitlPolicyService } from './services/human-review.service';
import { ObservabilityService } from './services/observability.service';
import { ExecutionController } from './controllers/execution.controller';
import { TicketExecutionController } from './controllers/ticket-execution.controller';
import { HumanReviewController } from './controllers/human-review.controller';
import { ObservabilityController } from './controllers/observability.controller';
import { AdminFeedbackController } from './controllers/admin-feedback.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AdminFeedbackService } from './services/admin-feedback.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsController } from './controllers/analytics.controller';

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
      Tipology,
      Complaint,
      TicketLock,
      ComplaintUserNote,
      ResponseTemplate,
    ]),
    OrquestracaoModule,
    OperacaoModule,
    IaModule,                  // provides AI agents for skill dispatch
    MemoriaModule,             // provides CaseMemory + HumanFeedbackMemory repos for PersistMemory skill
    BaseDeConhecimentoModule,  // provides VectorSearchService, TemplateResolverService, MandatoryInfoResolverService
    RegulatorioModule,         // provides Persona repo for ApplyPersonaTone skill
  ],
  controllers: [ExecutionController, TicketExecutionController, HumanReviewController, ObservabilityController, AdminFeedbackController, AdminAuditController, AnalyticsController],
  providers: [ExecutionService, TicketExecutionService, SkillRegistryService, HumanReviewService, HitlPolicyService, ObservabilityService, AdminFeedbackService, AdminAuditService, AnalyticsService],
  exports: [TypeOrmModule, ExecutionService, TicketExecutionService, SkillRegistryService, HumanReviewService, HitlPolicyService],
})
export class ExecucaoModule {}
