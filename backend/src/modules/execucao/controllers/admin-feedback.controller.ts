import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { AdminFeedbackService } from '../services/admin-feedback.service';
import { AdminFeedbackQueryDto } from '../dto/admin-feedback.dto';

@Controller('admin/feedback')
@Roles(UserRole.ADMIN)
export class AdminFeedbackController {
  constructor(private readonly svc: AdminFeedbackService) {}

  /** GET /api/admin/feedback — paginated human feedback list (ADMIN only) */
  @Get()
  list(@Query() q: AdminFeedbackQueryDto) {
    return this.svc.list(q);
  }
}
