import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentIngestionService } from '../services/document-ingestion.service';
import { KbDocument } from '../../memoria/entities/kb-document.entity';
import { KbDocumentVersion } from '../../memoria/entities/kb-document-version.entity';
// NOTE: No @Roles('admin') decorator — global JwtAuthGuard already protects all endpoints.
// Role-based access control for KB management is a Phase 7 concern (RolesGuard not yet globally registered).

@Controller('kb')
export class KbManagerController {
  constructor(
    private readonly ingestionService: DocumentIngestionService,
    @InjectRepository(KbDocument)
    private readonly documentRepo: Repository<KbDocument>,
    @InjectRepository(KbDocumentVersion)
    private readonly versionRepo: Repository<KbDocumentVersion>,
  ) {}

  /**
   * POST /api/kb/upload
   * Uploads a PDF or text file and triggers ingestion pipeline.
   * Protected by global JwtAuthGuard. Requires admin role (Phase 7 concern).
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'text/plain'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new HttpException('Only PDF and TXT files are allowed', 400), false);
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('sourceType') sourceType: string,
    @Body('changeDescription') changeDescription?: string,
  ) {
    if (!file) {
      throw new HttpException('File is required', 400);
    }

    if (!sourceType) {
      throw new HttpException('sourceType is required (e.g., manual_anatel, guia_iqi)', 400);
    }

    const result = await this.ingestionService.ingest(
      file.buffer,
      file.originalname,
      sourceType,
      file.mimetype,
      changeDescription,
    );

    return {
      message: `Document ingested successfully: ${result.chunkCount} chunks created`,
      ...result,
    };
  }

  /**
   * GET /api/kb/documents
   * Lists all KB documents with their versions.
   */
  @Get('documents')
  async listDocuments(@Query('sourceType') sourceType?: string) {
    const query = this.documentRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.versions', 'v')
      .orderBy('d."createdAt"', 'DESC')
      .addOrderBy('v.version', 'DESC');

    if (sourceType) {
      query.where('d."sourceType" = :sourceType', { sourceType });
    }

    const documents = await query.getMany();

    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      mimeType: doc.mimeType,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      versions: doc.versions.map((v) => ({
        id: v.id,
        version: v.version,
        changeDescription: v.changeDescription,
        chunkCount: v.chunkCount,
        isActive: v.isActive,
        processedAt: v.processedAt,
        createdAt: v.createdAt,
      })),
    }));
  }

  /**
   * GET /api/kb/documents/:id
   * Gets a single document with all versions.
   */
  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    const doc = await this.documentRepo.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!doc) {
      throw new HttpException('Document not found', 404);
    }

    return doc;
  }

  /**
   * PATCH /api/kb/documents/:docId/versions/:versionId/activate
   * Activates a specific version (deactivates all others for same document).
   */
  @Patch('documents/:docId/versions/:versionId/activate')
  async activateVersion(
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
  ) {
    const version = await this.versionRepo.findOne({
      where: { id: versionId, documentId: docId },
    });

    if (!version) {
      throw new HttpException('Version not found', 404);
    }

    // Deactivate all versions for this document
    await this.versionRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('"documentId" = :docId', { docId })
      .execute();

    // Activate the selected version
    version.isActive = true;
    await this.versionRepo.save(version);

    return { message: `Version ${version.version} activated`, versionId };
  }
}
