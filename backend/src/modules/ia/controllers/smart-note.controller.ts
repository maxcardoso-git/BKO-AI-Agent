import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { SmartNoteAction, SmartNoteService } from '../services/smart-note.service';

@Controller('ai/smart-note')
export class SmartNoteController {
  constructor(private readonly smartNote: SmartNoteService) {}

  /** POST /api/ai/smart-note — process a snippet with a fixed action */
  @Post()
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)
  async process(
    @Body() body: { action: SmartNoteAction; text: string },
  ): Promise<{ text: string; model: string; provider: string }> {
    return this.smartNote.process(body.action, body.text);
  }
}
