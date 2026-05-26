import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminFeedbackQueryDto {
  @IsOptional()
  @IsString()
  tipologyId?: string;

  @IsOptional()
  @IsIn(['correction', 'rejection'])
  feedbackType?: 'correction' | 'rejection';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset?: number = 0;
}

export interface AdminFeedbackRowDto {
  id: string;
  complaintId: string;
  complaintProtocol: string | null;
  tipologyId: string | null;
  tipologyName: string | null;
  feedbackType: 'correction' | 'rejection' | null;
  aiText: string;
  humanText: string;
  diffDescription: string;
  rejectionReason: string | null;
  correctionCategory: string;
  correctionWeight: number;
  createdAt: string;
}
