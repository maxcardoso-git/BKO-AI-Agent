import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  HttpCode,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ComplaintService } from '../services/complaint.service';
import { TicketLockService } from '../services/ticket-lock.service';
import { ComplaintFilterDto } from '../dto/complaint-filter.dto';
import { ComplaintListResponse } from '../dto/complaint-list-response.dto';
import { Complaint } from '../entities/complaint.entity';
import { TicketLock } from '../entities/ticket-lock.entity';
import { TimingMetricsDto } from '../dto/timing-metrics.dto';
// SensitiveDataInterceptor removed — operators are internal authenticated users
// and need to see unmasked CPF / phone / address to handle the ticket.
import {
  TemplateFieldsExtractorService,
  TemplateFieldsResponse,
} from '../../ia/services/template-fields-extractor.service';

@Controller('complaints')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ComplaintController {
  constructor(
    private readonly complaintService: ComplaintService,
    private readonly ticketLockService: TicketLockService,
    private readonly templateFields: TemplateFieldsExtractorService,
  ) {}

  /** GET /api/complaints/:id/template-fields — operator-input fields
   *  extracted from the response template's "INFORMAÇÕES OBRIGATÓRIAS" section. */
  @Get(':id/template-fields')
  getTemplateFields(@Param('id', ParseUUIDPipe) id: string): Promise<TemplateFieldsResponse> {
    return this.templateFields.getFieldsForComplaint(id);
  }

  @Get()
  findAll(@Query() filters: ComplaintFilterDto): Promise<ComplaintListResponse> {
    return this.complaintService.findAll(filters);
  }

  /** POST /api/complaints/pull — grab next available complaint and lock it.
   *  Optional ?createdAfter & ?createdBefore (ISO) restrict to complaints
   *  imported in a given date range. */
  @Post('pull')
  @HttpCode(200)
  pull(
    @Request() req: any,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
  ): Promise<{ complaint: Complaint; lock: TicketLock }> {
    return this.ticketLockService.pullAndLock(req.user.id, {
      createdAfter,
      createdBefore,
    });
  }

  /** GET /api/complaints/by-protocol?q=XXX — search by protocol number */
  @Get('by-protocol')
  findByProtocol(@Query('q') q: string): Promise<Complaint[]> {
    return this.complaintService.findByProtocol(q ?? '');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Complaint> {
    return this.complaintService.findOne(id);
  }

  @Get(':id/timing')
  getTiming(@Param('id', ParseUUIDPipe) id: string): Promise<TimingMetricsDto> {
    return this.complaintService.getTimingMetrics(id);
  }
}
