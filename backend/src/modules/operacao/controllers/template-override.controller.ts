import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TemplateOverrideService, OverrideResult, TemplateSearchResult } from '../services/template-override.service';

@Controller()
export class TemplateOverrideController {
  constructor(private readonly service: TemplateOverrideService) {}

  /** GET /api/templates/search?q=<term> — operator-accessible lightweight
   *  template search for the /processar override modal. Returns up to 50
   *  active templates sorted by name. */
  @Get('templates/search')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  search(@Query('q') q?: string): Promise<TemplateSearchResult[]> {
    return this.service.search(q ?? '');
  }

  /** POST /api/complaints/:id/override-template — operator forces a specific
   *  IQI template. Body: { templateId, reason? }. Records the substitution in
   *  human_feedback_memory so the system can learn. */
  @Post('complaints/:id/override-template')
  @HttpCode(200)
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { templateId: string; reason?: string },
  ): Promise<OverrideResult> {
    return this.service.override(id, body.templateId, body.reason ?? null);
  }

  /** DELETE /api/complaints/:id/override-template — clears the override so
   *  the IA's tipology-based match resumes. */
  @Delete('complaints/:id/override-template')
  @HttpCode(200)
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  clear(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.clearOverride(id);
  }
}
