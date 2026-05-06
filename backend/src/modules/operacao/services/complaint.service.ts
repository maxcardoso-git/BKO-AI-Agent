import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from '../entities/complaint.entity';
import { ComplaintFilterDto } from '../dto/complaint-filter.dto';
import { ComplaintListResponse } from '../dto/complaint-list-response.dto';

@Injectable()
export class ComplaintService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,
  ) {}

  async findAll(filters: ComplaintFilterDto): Promise<ComplaintListResponse> {
    const {
      status,
      tipologyId,
      subtipologyId,
      situationId,
      riskLevel,
      isOverdue,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const qb = this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoinAndSelect('complaint.tipology', 'tipology')
      .leftJoinAndSelect('complaint.subtipology', 'subtipology')
      .leftJoinAndSelect('complaint.situation', 'situation')
      .leftJoinAndSelect('complaint.regulatoryAction', 'regulatoryAction');

    if (status) {
      qb.andWhere('complaint.status = :status', { status });
    }

    if (tipologyId) {
      qb.andWhere('complaint.tipologyId = :tipologyId', { tipologyId });
    }

    if (subtipologyId) {
      qb.andWhere('complaint.subtipologyId = :subtipologyId', { subtipologyId });
    }

    if (situationId) {
      qb.andWhere('complaint.situationId = :situationId', { situationId });
    }

    if (riskLevel) {
      qb.andWhere('complaint.riskLevel = :riskLevel', { riskLevel });
    }

    if (isOverdue !== undefined && isOverdue !== null) {
      const isOverdueBool = isOverdue === 'true';
      qb.andWhere('complaint.isOverdue = :isOverdue', { isOverdue: isOverdueBool });
    }

    if (search) {
      qb.andWhere(
        '(complaint.protocolNumber ILIKE :search OR complaint.rawText ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'protocolNumber',
      'status',
      'riskLevel',
      'slaDeadline',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    qb.orderBy(`complaint.${safeSortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Complaint> {
    const complaint = await this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoinAndSelect('complaint.tipology', 'tipology')
      .leftJoinAndSelect('complaint.subtipology', 'subtipology')
      .leftJoinAndSelect('complaint.situation', 'situation')
      .leftJoinAndSelect('complaint.regulatoryAction', 'regulatoryAction')
      .leftJoinAndSelect('complaint.details', 'details')
      .leftJoinAndSelect('complaint.history', 'history')
      .leftJoinAndSelect('complaint.attachments', 'attachments')
      .where('complaint.id = :id', { id })
      .getOne();

    if (!complaint) {
      throw new NotFoundException(`Complaint with id ${id} not found`);
    }

    return complaint;
  }
}
