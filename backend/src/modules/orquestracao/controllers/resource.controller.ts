import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { ResourceService } from '../services/resource.service';

@Controller()
export class ResourceController {
  constructor(private readonly svc: ResourceService) {}

  @Get('admin/resources')
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.svc.findAll();
  }

  @Get('admin/resources/:id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post('admin/resources')
  @Roles(UserRole.ADMIN)
  create(@Body() dto: Record<string, unknown>) {
    return this.svc.create(dto as never);
  }

  @Patch('admin/resources/:id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.svc.update(id, dto as never);
  }

  @Delete('admin/resources/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
