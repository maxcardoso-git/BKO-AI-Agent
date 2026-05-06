import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketExecution } from '../entities/ticket-execution.entity';
import { Artifact } from '../entities/artifact.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectRepository(TicketExecution)
    private readonly ticketExecutionRepository: Repository<TicketExecution>,
    @InjectRepository(Artifact)
    private readonly artifactRepository: Repository<Artifact>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findByComplaintId(complaintId: string): Promise<TicketExecution[]> {
    return this.ticketExecutionRepository
      .createQueryBuilder('ticketExecution')
      .leftJoinAndSelect('ticketExecution.stepExecutions', 'stepExecutions')
      .leftJoinAndSelect('stepExecutions.stepDefinition', 'stepDefinition')
      .where('ticketExecution.complaintId = :complaintId', { complaintId })
      .orderBy('ticketExecution.createdAt', 'DESC')
      .getMany();
  }

  async findArtifactsByComplaintId(complaintId: string): Promise<Artifact[]> {
    return this.artifactRepository
      .createQueryBuilder('artifact')
      .where('artifact.complaintId = :complaintId', { complaintId })
      .orderBy('artifact.createdAt', 'DESC')
      .getMany();
  }

  async findAuditLogsByComplaintId(complaintId: string): Promise<AuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('auditLog')
      .where('auditLog.entityType = :entityType', { entityType: 'complaint' })
      .andWhere('auditLog.entityId = :complaintId', { complaintId })
      .orderBy('auditLog.createdAt', 'DESC')
      .getMany();
  }
}
