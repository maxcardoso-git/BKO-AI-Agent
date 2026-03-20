import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class SubmitReviewDto {
  @IsString()
  @IsOptional()
  humanFinal?: string | null;

  // Legacy alias accepted from older clients
  @IsString()
  @IsOptional()
  humanFinalText?: string | null;

  @IsString()
  @IsOptional()
  correctionReason?: string | null;

  @IsObject()
  @IsOptional()
  checklist?: Record<string, boolean> | null;

  // Legacy alias
  @IsObject()
  @IsOptional()
  checklistItems?: Record<string, boolean> | null;

  @IsString()
  @IsOptional()
  observations?: string | null;

  @IsBoolean()
  approved: boolean;
}
