import {
  Controller,
  Get,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { StepsDesignerService } from '../services/steps-designer.service';
import { UpdateStepsDto, UpdateTransitionsDto } from '../dto/update-steps.dto';
import { Capability } from '../entities/capability.entity';
import { CapabilityVersion } from '../entities/capability-version.entity';
import { StepDefinition } from '../entities/step-definition.entity';
import { StepTransitionRule } from '../entities/step-transition-rule.entity';

@Controller()
export class StepsDesignerController {
  constructor(
    private readonly stepsDesignerService: StepsDesignerService,
  ) {}

  /**
   * GET /api/admin/capabilities
   * Lists all capabilities with their versions and step definitions (ordered by stepOrder).
   */
  @Get('admin/capabilities')
  listCapabilities(): Promise<Capability[]> {
    return this.stepsDesignerService.listCapabilities();
  }

  /**
   * GET /api/admin/capabilities/:capId/versions/:verId
   * Returns a single capability version with step definitions and skill bindings.
   */
  @Get('admin/capabilities/:capId/versions/:verId')
  getVersion(
    @Param('verId') verId: string,
  ): Promise<CapabilityVersion> {
    return this.stepsDesignerService.getCapabilityVersion(verId);
  }

  /**
   * PUT /api/admin/capabilities/:capId/versions/:verId/steps
   * Atomically reorders and updates StepDefinition rows.
   * Accepts skillKey and llmModel per step — upserts StepSkillBinding.
   */
  @Put('admin/capabilities/:capId/versions/:verId/steps')
  updateSteps(
    @Param('verId') verId: string,
    @Body() body: UpdateStepsDto,
  ): Promise<StepDefinition[]> {
    return this.stepsDesignerService.updateSteps(verId, body.steps);
  }

  /**
   * GET /api/admin/steps/:stepId/transitions
   * Returns StepTransitionRule array for a step, ordered by priority.
   */
  @Get('admin/steps/:stepId/transitions')
  getTransitions(
    @Param('stepId') stepId: string,
  ): Promise<StepTransitionRule[]> {
    return this.stepsDesignerService.getTransitions(stepId);
  }

  /**
   * PUT /api/admin/steps/:stepId/transitions
   * Replaces all StepTransitionRule rows for a step (delete + insert).
   */
  @Put('admin/steps/:stepId/transitions')
  updateTransitions(
    @Param('stepId') stepId: string,
    @Body() body: UpdateTransitionsDto,
  ): Promise<StepTransitionRule[]> {
    return this.stepsDesignerService.updateTransitions(stepId, body.transitions);
  }
}
