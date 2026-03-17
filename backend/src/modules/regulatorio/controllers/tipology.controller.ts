import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tipology } from '../entities/tipology.entity';

@Controller('tipologies')
export class TipologyController {
  constructor(
    @InjectRepository(Tipology)
    private readonly tipologyRepository: Repository<Tipology>,
  ) {}

  @Get()
  findAll(): Promise<Tipology[]> {
    return this.tipologyRepository.find({
      where: { isActive: true },
      order: { label: 'ASC' },
      select: ['id', 'key', 'label', 'slaBusinessDays'],
    });
  }
}
