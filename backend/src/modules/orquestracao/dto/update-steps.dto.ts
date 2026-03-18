import {
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StepItemDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsNumber()
  stepOrder: number;

  @IsBoolean()
  isHumanRequired: boolean;

  /** skillKey maps to SkillDefinition.key — used to upsert StepSkillBinding */
  @IsString()
  @IsOptional()
  skillKey?: string | null;

  /** llmModel stored on StepSkillBinding.llmModel */
  @IsString()
  @IsOptional()
  llmModel?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepItemDto)
  steps: StepItemDto[];
}

/**
 * TransitionRuleDto maps to StepTransitionRule entity fields:
 *   conditionType, conditionExpression, targetStepKey
 */
export class TransitionRuleDto {
  @IsString()
  conditionType: string;

  @IsObject()
  conditionExpression: Record<string, unknown>;

  @IsString()
  targetStepKey: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsString()
  @IsOptional()
  description?: string | null;
}

export class UpdateTransitionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransitionRuleDto)
  transitions: TransitionRuleDto[];
}
