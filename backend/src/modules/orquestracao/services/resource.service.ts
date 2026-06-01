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

/** Generates a short masked preview of a secret. Shows first 8 + last 4 chars
 *  joined by `***` so the operator can recognize the key visually without
 *  seeing it in full. Short secrets get fully asterisked. */
function maskSecret(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (t.length <= 12) return '*'.repeat(t.length);
  return `${t.slice(0, 8)}***${t.slice(-4)}`;
}

/** Returns a public-safe view of a resource — raw secret columns are replaced
 *  by masked previews + boolean "has*" flags so the UI can tell whether a
 *  value is set without ever receiving the real key over the wire. */
function maskResource(r: Resource): Record<string, unknown> {
  return {
    ...r,
    apiKeyValue: maskSecret(r.apiKeyValue),
    bearerToken: maskSecret(r.bearerToken),
    basicPassword: maskSecret(r.basicPassword),
    hasApiKeyValue: !!r.apiKeyValue && r.apiKeyValue.trim().length > 0,
    hasBearerToken: !!r.bearerToken && r.bearerToken.trim().length > 0,
    hasBasicPassword: !!r.basicPassword && r.basicPassword.trim().length > 0,
  };
}

/** True when the incoming string looks like the masked echo of an existing
 *  secret (contains `***`) — the operator didn't actually type a new value,
 *  so the backend must NOT overwrite the real one. */
function isMaskedEcho(s: string | null | undefined): boolean {
  return !!s && s.includes('***');
}

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private readonly repo: Repository<Resource>,
  ) {}

  async findAll(): Promise<Record<string, unknown>[]> {
    const rows = await this.repo.find({ order: { name: 'ASC' } });
    return rows.map(maskResource);
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const r = await this.findOneRaw(id);
    return maskResource(r);
  }

  private async findOneRaw(id: string): Promise<Resource> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Resource ${id} not found`);
    return r;
  }

  async create(dto: CreateResourceDto): Promise<Record<string, unknown>> {
    const r = this.repo.create(dto);
    const saved = await this.repo.save(r);
    return maskResource(saved);
  }

  /**
   * Updates a resource, treating apiKeyValue / bearerToken / basicPassword
   * with extra care:
   *   - empty / null / undefined → keep existing value (no overwrite)
   *   - matches masked echo pattern (contains `***`) → keep existing
   *   - non-empty real value     → overwrite
   *
   * This lets the dialog send the whole form back without accidentally
   * blanking out a secret the operator never touched.
   */
  async update(id: string, dto: UpdateResourceDto): Promise<Record<string, unknown>> {
    const r = await this.findOneRaw(id);
    const { apiKeyValue, bearerToken, basicPassword, ...rest } = dto;
    Object.assign(r, rest);

    if (apiKeyValue !== undefined && apiKeyValue !== null) {
      const v = String(apiKeyValue).trim();
      if (v.length > 0 && !isMaskedEcho(v)) r.apiKeyValue = v;
    }
    if (bearerToken !== undefined && bearerToken !== null) {
      const v = String(bearerToken).trim();
      if (v.length > 0 && !isMaskedEcho(v)) r.bearerToken = v;
    }
    if (basicPassword !== undefined && basicPassword !== null) {
      const v = String(basicPassword).trim();
      if (v.length > 0 && !isMaskedEcho(v)) r.basicPassword = v;
    }

    const saved = await this.repo.save(r);
    return maskResource(saved);
  }

  async remove(id: string): Promise<void> {
    const r = await this.findOneRaw(id);
    await this.repo.remove(r);
  }
}
