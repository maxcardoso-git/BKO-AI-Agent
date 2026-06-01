import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import {
  SmartNoteAction,
  SmartNoteResult,
  PersonaCheckResult,
  SmartNoteService,
} from '../services/smart-note.service';

@Controller('ai')
export class SmartNoteController {
  constructor(private readonly smartNote: SmartNoteService) {}

  /** POST /api/ai/smart-note — process a snippet with a fixed action.
   *  When complaintId is provided, the persona attached to the complaint's
   *  tipology biases the generation toward its tone + required + forbidden
   *  expressions. */
  @Post('smart-note')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  async process(
    @Body() body: { action: SmartNoteAction; text: string; complaintId?: string },
  ): Promise<SmartNoteResult> {
    return this.smartNote.process(body.action, body.text, body.complaintId);
  }

  /** POST /api/ai/persona-check — validates text against the persona attached
   *  to the complaint's tipology. Returns the violations. Used by the /validar
   *  Aprovar/Corrigir flow to block submissions that don't match the style. */
  @Post('persona-check')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  async check(
    @Body() body: { complaintId: string; text: string },
  ): Promise<PersonaCheckResult> {
    return this.smartNote.checkPersona(body.complaintId, body.text);
  }
}
