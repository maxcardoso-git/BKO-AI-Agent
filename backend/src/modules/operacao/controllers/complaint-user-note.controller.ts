import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  Request,
  HttpCode,
} from '@nestjs/common';
import { ComplaintUserNoteService } from '../services/complaint-user-note.service';
import { ComplaintUserNote } from '../entities/complaint-user-note.entity';

@Controller('complaints/:id/notes')
export class ComplaintUserNoteController {
  constructor(private readonly noteService: ComplaintUserNoteService) {}

  /** GET /api/complaints/:id/notes — all notes ordered by version DESC */
  @Get()
  findAll(@Param('id', ParseUUIDPipe) id: string): Promise<ComplaintUserNote[]> {
    return this.noteService.findAll(id);
  }

  /** POST /api/complaints/:id/notes — create a new note version */
  @Post()
  @HttpCode(201)
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string; parameters?: Record<string, unknown> },
    @Request() req: any,
  ): Promise<ComplaintUserNote> {
    return this.noteService.create(id, req.user.id, body.content, body.parameters);
  }
}
