import {
  Body,
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
import { ComplaintService, ComplianceRecheckResult } from '../services/complaint.service';
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
import { MandatoryFieldExtractorAgent, ExtractedField } from '../../ia/services/mandatory-field-extractor.agent';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { MandatoryInfoRule } from '../../regulatorio/entities/mandatory-info-rule.entity';

@Controller('complaints')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ComplaintController {
  constructor(
    private readonly complaintService: ComplaintService,
    private readonly ticketLockService: TicketLockService,
    private readonly templateFields: TemplateFieldsExtractorService,
    private readonly mandatoryExtractor: MandatoryFieldExtractorAgent,
    @InjectRepository(MandatoryInfoRule)
    private readonly mandatoryRuleRepo: Repository<MandatoryInfoRule>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
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

  /** POST /api/complaints/:id/compliance-recheck — re-evaluates presence-based
   *  compliance against the latest operator note AND the latest AI draft.
   *  Accepts an optional `draftText` in the body so the UI can pass its current
   *  (possibly unsaved) draft buffer, which is what the operator is actually
   *  evaluating. Body is optional — when absent, falls back to the saved draft
   *  artifact. POST is used because draftText can be long. */
  @Post(':id/compliance-recheck')
  @HttpCode(200)
  recheckCompliance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { draftText?: string },
  ): Promise<ComplianceRecheckResult> {
    return this.complaintService.recomputeCompliance(id, body?.draftText);
  }

  /** POST /api/complaints/:id/extract-mandatory-fields — runs the LLM over the
   *  consumer complaint text and suggests values for every ANATEL mandatory
   *  field (rules with tipologyId IS NULL, the global checklist). The
   *  frontend surfaces these as pre-filled, editable inputs in the NoteForm
   *  with an IA badge — operator reviews and overrides as needed before
   *  hitting Processar. Strict: never invent values, returns hasSignal=false
   *  when the text is silent on a field. */
  @Post(':id/extract-mandatory-fields')
  @HttpCode(200)
  async extractMandatoryFields(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ fields: ExtractedField[] }> {
    const complaint = await this.complaintRepo.findOneOrFail({
      where: { id },
      select: ['id', 'rawText'],
    });
    const rules = await this.mandatoryRuleRepo.find({
      where: { tipologyId: IsNull(), isActive: true },
      order: { sortOrder: 'ASC' },
    });
    const fields = await this.mandatoryExtractor.extract(
      complaint.rawText ?? '',
      rules.map((r) => ({
        fieldName: r.fieldName,
        fieldLabel: r.fieldLabel,
        fieldDescription: r.description ?? null,
      })),
    );
    return { fields };
  }
}
