import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InvoiceService } from '../services/invoice.service';
import { Invoice } from '../entities/invoice.entity';

@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('invoices')
  findAll(@Query('protocolNumber') protocolNumber?: string): Promise<Invoice[]> {
    return this.invoiceService.findAll(protocolNumber);
  }

  @Get('invoices/by-protocol/:protocolNumber')
  findByProtocol(@Param('protocolNumber') protocolNumber: string): Promise<Invoice[]> {
    return this.invoiceService.findByProtocol(protocolNumber);
  }

  @Post('admin/invoices')
  create(@Body() dto: Partial<Invoice>): Promise<Invoice> {
    return this.invoiceService.create(dto);
  }

  @Patch('admin/invoices/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<Invoice>,
  ): Promise<Invoice> {
    return this.invoiceService.update(id, dto);
  }

  @Delete('admin/invoices/:id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.invoiceService.remove(id);
  }
}
