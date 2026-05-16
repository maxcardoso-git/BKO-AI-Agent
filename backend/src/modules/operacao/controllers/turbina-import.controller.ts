import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TurbinaImportService, TurbinaImportResult, TurbinaRow } from '../services/turbina-import.service';

@Controller('complaints/turbina')
export class TurbinaImportController {
  constructor(private readonly importer: TurbinaImportService) {}

  /** POST /api/complaints/turbina/import — bulk import a batch of rows already filtered by the client */
  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async import(@Body() body: { rows: TurbinaRow[] }): Promise<TurbinaImportResult> {
    return this.importer.importBatch(body?.rows ?? []);
  }
}
