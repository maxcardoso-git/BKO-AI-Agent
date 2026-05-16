import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async findAll(protocolNumber?: string): Promise<Invoice[]> {
    if (protocolNumber) {
      return this.invoiceRepo.find({
        where: { protocolNumber },
        order: { dueDate: 'DESC' },
      });
    }
    return this.invoiceRepo.find({ order: { dueDate: 'DESC' } });
  }

  async findByProtocol(protocolNumber: string): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { protocolNumber },
      order: { dueDate: 'DESC' },
    });
  }

  async create(dto: Partial<Invoice>): Promise<Invoice> {
    const entity = this.invoiceRepo.create(dto);
    return this.invoiceRepo.save(entity);
  }

  async update(id: string, dto: Partial<Invoice>): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Fatura com id ${id} nao encontrada`);
    Object.assign(existing, dto);
    return this.invoiceRepo.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.invoiceRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Fatura com id ${id} nao encontrada`);
    await this.invoiceRepo.remove(existing);
  }
}
