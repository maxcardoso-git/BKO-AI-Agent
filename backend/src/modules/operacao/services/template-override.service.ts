import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from '../entities/complaint.entity';
import { ResponseTemplate } from '../../regulatorio/entities/response-template.entity';
import { Artifact } from '../../execucao/entities/artifact.entity';
import { VectorSearchService } from '../../base-de-conhecimento/services/vector-search.service';

export interface TemplateSearchResult {
  id: string;
  name: string;
  tipologyId: string | null;
  situationId: string | null;
  isActive: boolean;
  contentPreview: string;
}

export interface OverrideResult {
  complaintId: string;
  previousTemplateId: string | null;
  newTemplateId: string;
  templateName: string;
  memoryRecorded: boolean;
}

@Injectable()
export class TemplateOverrideService {
  private readonly logger = new Logger(TemplateOverrideService.name);

  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(ResponseTemplate)
    private readonly templateRepo: Repository<ResponseTemplate>,
    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  /** Lightweight template search for the /processar override modal. Returns
   *  active templates whose name matches the query (or all when no query).
   *  Limited to 50 results sorted by name. */
  async search(query: string): Promise<TemplateSearchResult[]> {
    const qb = this.templateRepo
      .createQueryBuilder('t')
      .where('t."isActive" = true')
      .orderBy('t.name', 'ASC')
      .limit(50);

    if (query && query.trim().length >= 2) {
      qb.andWhere('LOWER(t.name) LIKE :q', { q: `%${query.trim().toLowerCase()}%` });
    }

    const rows = await qb.getMany();
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      tipologyId: t.tipologyId,
      situationId: t.situationId,
      isActive: t.isActive,
      contentPreview: (t.templateContent ?? '').slice(0, 200),
    }));
  }

  /**
   * Forces a specific IQI template on a complaint. After this call:
   * - complaint.templateOverrideId is set
   * - the existing iqi_template artifact is updated (or a new one inserted)
   *   so /processar shows the chosen template immediately
   * - the pipeline (when started) uses this template via TemplateResolverService
   *
   * The override is also recorded as an operator correction in
   * human_feedback_memory so future similar tickets can leverage the signal.
   * The embedding column is populated lazily by the memory pipeline; for now
   * we just persist the textual feedback (correctionCategory='iqi_substitution').
   */
  async override(
    complaintId: string,
    templateId: string,
    reason: string | null,
  ): Promise<OverrideResult> {
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException(`Complaint ${complaintId} not found`);

    const newTemplate = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!newTemplate) throw new NotFoundException(`Template ${templateId} not found`);
    if (!newTemplate.isActive) {
      throw new BadRequestException('Cannot override with an inactive template');
    }

    // Capture the previous IQI artifact (if any) — used both to know "what the
    // LLM had picked" and to feed the feedback memory.
    const previousArtifact = await this.artifactRepo.findOne({
      where: { complaintId, artifactType: 'iqi_template' },
      order: { createdAt: 'DESC' },
    });
    const previousTemplateId = (previousArtifact?.content?.['templateId'] as string | undefined) ?? null;
    const previousTemplateName = (previousArtifact?.content?.['templateName'] as string | undefined) ?? null;

    // 1. Persist the override on the complaint
    complaint.templateOverrideId = templateId;
    await this.complaintRepo.save(complaint);

    // 2. Refresh the cached iqi_template artifact with the operator's choice
    const newContent = {
      templateId: newTemplate.id,
      templateName: newTemplate.name,
      templateContent: newTemplate.templateContent,
      matchType: 'operator_override',
      overriddenFromTemplateId: previousTemplateId,
      overriddenFromTemplateName: previousTemplateName,
      overrideReason: reason ?? null,
    };
    if (previousArtifact) {
      previousArtifact.content = newContent;
      await this.artifactRepo.save(previousArtifact);
    } else {
      await this.artifactRepo.save(
        this.artifactRepo.create({
          artifactType: 'iqi_template',
          content: newContent,
          version: 1,
          complaintId,
          stepExecutionId: null,
        }),
      );
    }

    // 3. Best-effort: record the substitution in human_feedback_memory.
    //    Embeds the complaint's rawText so future similar tickets can find
    //    this correction via pgvector cosine similarity. The referenceId
    //    column holds the chosen templateId for direct retrieval.
    let memoryRecorded = false;
    try {
      const aiText = previousTemplateName
        ? `IQI escolhido pela IA: ${previousTemplateName}`
        : 'IQI nao escolhido pela IA';
      const humanText = `IQI escolhido pelo operador: ${newTemplate.name}`;
      const diff = reason && reason.trim() ? reason.trim() : 'Operador substituiu o IQI sem motivo declarado';
      // Embed the COMPLAINT text — that's the input the IA classified, so it's
      // what we want to match against on future incoming tickets.
      const embeddingText = (complaint.rawText ?? '').slice(0, 8000) || newTemplate.name;
      const vec = await this.vectorSearch.generateEmbedding(embeddingText);
      const embeddingSql = `[${vec.join(',')}]`;
      await this.complaintRepo.query(
        `INSERT INTO human_feedback_memory
           ("aiText","humanText","diffDescription","correctionCategory","correctionWeight","embedding","complaintId","tipologyId","feedbackType","referenceId","referenceType","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6::vector,$7,$8,$9,$10,$11, now())`,
        [
          aiText,
          humanText,
          diff,
          'iqi_substitution',
          1.0,
          embeddingSql,
          complaintId,
          complaint.tipologyId,
          'iqi_substitution',
          newTemplate.id,
          'response_template',
        ],
      );
      memoryRecorded = true;
    } catch (err) {
      this.logger.warn(`Could not write iqi_substitution to human_feedback_memory: ${err}`);
    }

    return {
      complaintId,
      previousTemplateId,
      newTemplateId: templateId,
      templateName: newTemplate.name,
      memoryRecorded,
    };
  }

  /** Clears the operator override so the IA's tipology-based match takes over. */
  async clearOverride(complaintId: string): Promise<{ complaintId: string }> {
    const complaint = await this.complaintRepo.findOne({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException(`Complaint ${complaintId} not found`);
    complaint.templateOverrideId = null;
    await this.complaintRepo.save(complaint);
    return { complaintId };
  }
}
