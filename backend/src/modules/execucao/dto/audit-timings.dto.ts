import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminAuditTimingsQueryDto {
  @IsOptional()
  @IsString()
  tipologyId?: string;

  @IsOptional()
  @IsString()
  periodStart?: string; // ISO date

  @IsOptional()
  @IsString()
  periodEnd?: string;

  @IsOptional()
  @IsIn(['OPERATOR', 'SUPERVISOR', 'ADMIN'])
  userRole?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset?: number = 0;
}

export interface AuditTimingRowDto {
  complaintId: string;
  protocolNumber: string;
  tipologyName: string | null;
  responsavelFinalName: string | null;
  responsavelFinalRole: string | null;
  createdAt: string;
  finishedAt: string | null;
  tempoTotalMin: number | null;
  tempoSlaMin: number | null;
  tempoRevisaoHumanaMin: number | null;
  tempoNotaParaProcessamentoMin: number | null;
  tempoAprovacaoParaConclusaoMin: number | null;
}
