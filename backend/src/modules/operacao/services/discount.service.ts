import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from '../entities/discount.entity';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(Discount)
    private readonly discountRepo: Repository<Discount>,
  ) {}

  async findAll(protocolNumber?: string): Promise<Discount[]> {
    if (protocolNumber) {
      return this.discountRepo.find({
        where: { protocolNumber },
        order: { activatedAt: 'DESC' },
      });
    }
    return this.discountRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findByProtocol(protocolNumber: string): Promise<Discount[]> {
    return this.discountRepo.find({
      where: { protocolNumber },
      order: { activatedAt: 'DESC' },
    });
  }

  async create(dto: Partial<Discount>): Promise<Discount> {
    const entity = this.discountRepo.create(dto);
    return this.discountRepo.save(entity);
  }

  async update(id: string, dto: Partial<Discount>): Promise<Discount> {
    const existing = await this.discountRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Desconto com id ${id} nao encontrado`);
    }
    Object.assign(existing, dto);
    return this.discountRepo.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.discountRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Desconto com id ${id} nao encontrado`);
    }
    await this.discountRepo.remove(existing);
  }
}
