import { IsString, IsOptional, IsBoolean, IsObject, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';

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

  // Legacy boolean field — kept for backward compat (old clients send approved:true)
  @IsBoolean()
  @IsOptional()
  approved?: boolean;

  // New explicit decision field (Phase 10+).
  // If absent, falls back to legacy approved boolean: approved=true -> 'approved', else 'corrected'
  @IsOptional()
  @IsIn(['approved', 'corrected', 'rejected'])
  decision?: 'approved' | 'corrected' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;

  // Operator's quality rating of the AI draft (1-3 stars). Required by the
  // validation UI; controller-level guard rejects requests where it's missing.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  aiResponseRating?: number;
}
