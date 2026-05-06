import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ComplaintService } from '../services/complaint.service';
import { ComplaintFilterDto } from '../dto/complaint-filter.dto';
import { ComplaintListResponse } from '../dto/complaint-list-response.dto';
import { Complaint } from '../entities/complaint.entity';
import { TimingMetricsDto } from '../dto/timing-metrics.dto';
import { SensitiveDataInterceptor } from '../../../interceptors/sensitive-data.interceptor';

@UseInterceptors(SensitiveDataInterceptor)
@Controller('complaints')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @Get()
  findAll(@Query() filters: ComplaintFilterDto): Promise<ComplaintListResponse> {
    return this.complaintService.findAll(filters);
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
