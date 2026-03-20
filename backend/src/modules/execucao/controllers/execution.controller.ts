import { Controller, Get, Param, ParseUUIDPipe, UseInterceptors } from '@nestjs/common';
import { ExecutionService } from '../services/execution.service';
import { TicketExecution } from '../entities/ticket-execution.entity';
import { Artifact } from '../entities/artifact.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { SensitiveDataInterceptor } from '../../../interceptors/sensitive-data.interceptor';

@UseInterceptors(SensitiveDataInterceptor)
@Controller('complaints/:complaintId')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Get('executions')
  findExecutions(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
  ): Promise<TicketExecution[]> {
    return this.executionService.findByComplaintId(complaintId);
  }

  @Get('artifacts')
  findArtifacts(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
  ): Promise<Artifact[]> {
    return this.executionService.findArtifactsByComplaintId(complaintId);
  }

  @Get('executions/:execId/artifacts')
  findArtifactsByExecution(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
  ): Promise<Artifact[]> {
    return this.executionService.findArtifactsByComplaintId(complaintId);
  }

  @Get('logs')
  findLogs(
    @Param('complaintId', ParseUUIDPipe) complaintId: string,
  ): Promise<AuditLog[]> {
    return this.executionService.findAuditLogsByComplaintId(complaintId);
  }
}
