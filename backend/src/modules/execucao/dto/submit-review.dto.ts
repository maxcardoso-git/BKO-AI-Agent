import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class SubmitReviewDto {
  @IsString()
  @IsOptional()
  humanFinalText?: string | null;

  @IsString()
  @IsOptional()
  correctionReason?: string | null;

  @IsObject()
  @IsOptional()
  checklistItems?: Record<string, boolean> | null;

  @IsString()
  @IsOptional()
  observations?: string | null;

  @IsBoolean()
  approved: boolean;
}
