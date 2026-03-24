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
import { DiscountService } from '../services/discount.service';
import { Discount } from '../entities/discount.entity';

@Controller()
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Get('discounts')
  findAll(@Query('protocolNumber') protocolNumber?: string): Promise<Discount[]> {
    return this.discountService.findAll(protocolNumber);
  }

  @Get('discounts/by-protocol/:protocolNumber')
  findByProtocol(@Param('protocolNumber') protocolNumber: string): Promise<Discount[]> {
    return this.discountService.findByProtocol(protocolNumber);
  }

  @Post('admin/discounts')
  create(@Body() dto: Partial<Discount>): Promise<Discount> {
    return this.discountService.create(dto);
  }

  @Patch('admin/discounts/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<Discount>,
  ): Promise<Discount> {
    return this.discountService.update(id, dto);
  }

  @Delete('admin/discounts/:id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.discountService.remove(id);
  }
}
