import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from '../entities/resource.entity';

export interface CreateResourceDto {
  name: string;
  type?: string;
  subtype?: string;
  llmProvider?: string | null;
  llmModel?: string | null;
  endpoint?: string | null;
  httpMethod?: string;
  authMode?: string;
  bearerToken?: string | null;
  apiKeyHeader?: string | null;
  apiKeyValue?: string | null;
  basicUser?: string | null;
  basicPassword?: string | null;
  connectionJson?: Record<string, unknown> | null;
  configurationJson?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
  tags?: string[] | null;
  environment?: string;
  isActive?: boolean;
}

export type UpdateResourceDto = Partial<CreateResourceDto>;

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private readonly repo: Repository<Resource>,
  ) {}

  findAll(): Promise<Resource[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Resource> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Resource ${id} not found`);
    return r;
  }

  create(dto: CreateResourceDto): Promise<Resource> {
    const r = this.repo.create(dto);
    return this.repo.save(r);
  }

  async update(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const r = await this.findOne(id);
    Object.assign(r, dto);
    return this.repo.save(r);
  }

  async remove(id: string): Promise<void> {
    const r = await this.findOne(id);
    await this.repo.remove(r);
  }
}
