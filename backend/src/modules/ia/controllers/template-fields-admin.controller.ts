import { Controller, Get, Post, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { TemplateFieldsExtractorService, ReprocessResult } from '../services/template-fields-extractor.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseTemplate } from '../../regulatorio/entities/response-template.entity';
import { Tipology } from '../../regulatorio/entities/tipology.entity';
import { Situation } from '../../regulatorio/entities/situation.entity';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';

@Controller('admin/templates')
export class TemplateFieldsAdminController {
  constructor(
    private readonly service: TemplateFieldsExtractorService,
    @InjectRepository(ResponseTemplate)
    private readonly templateRepo: Repository<ResponseTemplate>,
    @InjectRepository(Tipology)
    private readonly tipologyRepo: Repository<Tipology>,
    @InjectRepository(Situation)
    private readonly situationRepo: Repository<Situation>,
  ) {}

  /** GET /api/admin/templates/fields-audit — audit data per template: name,
   *  whether requiredFieldsCache is populated, the cached field labels/types
   *  themselves (so the UI can render them as chips), count of {{handlebars}}
   *  placeholders, and whether INFORMACOES OBRIGATORIAS is present. Used by
   *  /templates UI to flag templates needing reprocess. ADMIN only. */
  @Get('fields-audit')
  @Roles(UserRole.ADMIN)
  async audit(): Promise<
    Array<{
      id: string;
      name: string | null;
      isActive: boolean;
      hasCache: boolean;
      cachedFieldsCount: number;
      cachedFields: Array<{
        key: string;
        label: string;
        type: string;
        isRequired: boolean;
        group: string | null;
        mutexGroup: string | null;
      }>;
      handlebarsCount: number;
      hasMandatoryInfoSection: boolean;
    }>
  > {
    const all = await this.templateRepo.find();
    return all.map((t) => {
      const handlebars = new Set(
        Array.from(t.templateContent.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)).map((m) => (m[1] ?? '').trim().toLowerCase()),
      );
      const hasMandatoryInfo = /INFORMA[CÇ][OÕ]ES\s+OBRIGAT[OÓ]RIAS/i.test(t.templateContent);
      const cached = (t.requiredFieldsCache?.fields ?? []) as Array<{
        key: string;
        label: string;
        type: string;
        isRequired?: boolean;
        group?: string | null;
        mutexGroup?: string | null;
      }>;
      return {
        id: t.id,
        name: t.name ?? null,
        isActive: t.isActive,
        hasCache: cached.length > 0,
        cachedFieldsCount: cached.length,
        cachedFields: cached.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          isRequired: f.isRequired !== false,
          group: f.group ?? null,
          mutexGroup: f.mutexGroup ?? null,
        })),
        handlebarsCount: handlebars.size,
        hasMandatoryInfoSection: hasMandatoryInfo,
      };
    });
  }

  /** POST /api/admin/templates/:id/reprocess-fields?force=1 — re-extracts
   *  fields for a single template. force=1 ignores cache. */
  @Post(':id/reprocess-fields')
  @Roles(UserRole.ADMIN)
  reprocessOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    return this.service.reprocessTemplate(id, force === '1' || force === 'true');
  }

  /** POST /api/admin/templates/reprocess-all-fields?force=1 — bulk reprocess.
   *  Recommended call: force=1 the first time, to backfill templates that had
   *  no fields detected because they only use {{handlebars}}. */
  @Post('reprocess-all-fields')
  @Roles(UserRole.ADMIN)
  reprocessAll(@Query('force') force?: string): Promise<ReprocessResult> {
    return this.service.reprocessAll(force === '1' || force === 'true');
  }

  /** GET /api/admin/templates/export-xlsx — streams an Excel workbook with:
   *  - "Resumo" sheet: counts per tipology + global stats
   *  - "IQIs" sheet: one row per template with concatenated field labels
   *  - One sheet per tipology: granular field-level breakdown
   *  ADMIN + SUPERVISOR. */
  @Get('export-xlsx')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async exportXlsx(@Res() res: Response): Promise<void> {
    const [templates, tipologies, situations] = await Promise.all([
      this.templateRepo.find(),
      this.tipologyRepo.find(),
      this.situationRepo.find(),
    ]);

    const tipologyById = new Map(tipologies.map((t) => [t.id, t]));
    const situationById = new Map(situations.map((s) => [s.id, s]));
    const tipologyName = (id: string | null): string =>
      id ? (tipologyById.get(id)?.label ?? tipologyById.get(id)?.key ?? 'Sem tipologia') : 'Sem tipologia';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'BKO Agent';
    wb.created = new Date();

    const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1F2937' } };
    const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const styleHeader = (row: ExcelJS.Row) => {
      row.eachCell((cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      });
      row.height = 22;
    };

    // ─── Sheet 1: Resumo ─────────────────────────────────────────────────────
    const summarySheet = wb.addWorksheet('Resumo');
    summarySheet.columns = [
      { header: 'Tipologia', key: 'tipology', width: 30 },
      { header: 'Total de IQIs', key: 'count', width: 16 },
      { header: 'IQIs ativos', key: 'activeCount', width: 14 },
      { header: 'Total de campos', key: 'fieldCount', width: 18 },
      { header: 'IQIs sem campos detectados', key: 'noFields', width: 28 },
    ];
    styleHeader(summarySheet.getRow(1));

    // Group by tipology for summary
    const byTipology = new Map<string, typeof templates>();
    for (const t of templates) {
      const key = t.tipologyId ?? '__none__';
      if (!byTipology.has(key)) byTipology.set(key, []);
      byTipology.get(key)!.push(t);
    }
    const sortedTipologyEntries = Array.from(byTipology.entries()).sort((a, b) =>
      tipologyName(a[0] === '__none__' ? null : a[0]).localeCompare(
        tipologyName(b[0] === '__none__' ? null : b[0]),
      ),
    );

    let totalTemplates = 0;
    let totalActive = 0;
    let totalFields = 0;
    let totalNoFields = 0;
    for (const [tipId, items] of sortedTipologyEntries) {
      const activeCount = items.filter((t) => t.isActive).length;
      const fieldCount = items.reduce((acc, t) => acc + ((t.requiredFieldsCache?.fields as any[])?.length ?? 0), 0);
      const noFields = items.filter((t) => t.isActive && (!t.requiredFieldsCache?.fields || (t.requiredFieldsCache.fields as any[]).length === 0)).length;
      totalTemplates += items.length;
      totalActive += activeCount;
      totalFields += fieldCount;
      totalNoFields += noFields;
      summarySheet.addRow({
        tipology: tipologyName(tipId === '__none__' ? null : tipId),
        count: items.length,
        activeCount,
        fieldCount,
        noFields,
      });
    }
    const totalRow = summarySheet.addRow({
      tipology: 'TOTAL',
      count: totalTemplates,
      activeCount: totalActive,
      fieldCount: totalFields,
      noFields: totalNoFields,
    });
    totalRow.eachCell((cell) => { cell.font = { bold: true }; });

    // ─── Sheet 2: IQIs (flat list) ───────────────────────────────────────────
    const iqiSheet = wb.addWorksheet('IQIs');
    iqiSheet.columns = [
      { header: 'Tipologia', key: 'tipology', width: 24 },
      { header: 'Situação', key: 'situation', width: 22 },
      { header: 'Nome do IQI', key: 'name', width: 60 },
      { header: 'Versão', key: 'version', width: 8 },
      { header: 'Ativo', key: 'isActive', width: 8 },
      { header: 'Total de campos', key: 'fieldCount', width: 14 },
      { header: 'Campos detectados (label · tipo)', key: 'fields', width: 80 },
    ];
    styleHeader(iqiSheet.getRow(1));

    const sortedTemplates = [...templates].sort((a, b) => {
      const tipA = tipologyName(a.tipologyId);
      const tipB = tipologyName(b.tipologyId);
      if (tipA !== tipB) return tipA.localeCompare(tipB);
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
    for (const t of sortedTemplates) {
      const fields = (t.requiredFieldsCache?.fields ?? []) as Array<{ key: string; label: string; type: string; isRequired?: boolean; group?: string | null; mutexGroup?: string | null }>;
      const fieldsStr = fields.map((f) => {
        const flags: string[] = [];
        if (f.isRequired === false) flags.push('opcional');
        if (f.group) flags.push(`grupo:${f.group}`);
        if (f.mutexGroup) flags.push(`mutex:${f.mutexGroup}`);
        return `${f.label} · ${f.type}${flags.length ? ` (${flags.join(', ')})` : ''}`;
      }).join('\n');
      iqiSheet.addRow({
        tipology: tipologyName(t.tipologyId),
        situation: t.situationId ? (situationById.get(t.situationId)?.label ?? situationById.get(t.situationId)?.key ?? '—') : '—',
        name: t.name ?? '',
        version: t.version ?? 1,
        isActive: t.isActive ? 'Sim' : 'Não',
        fieldCount: fields.length,
        fields: fieldsStr,
      });
    }
    iqiSheet.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
    });

    // ─── Sheet 3: Campos por IQI (granular) ──────────────────────────────────
    const fieldsSheet = wb.addWorksheet('Campos por IQI');
    fieldsSheet.columns = [
      { header: 'Tipologia', key: 'tipology', width: 24 },
      { header: 'Nome do IQI', key: 'iqiName', width: 50 },
      { header: 'Chave', key: 'key', width: 28 },
      { header: 'Label', key: 'label', width: 36 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Obrigatório', key: 'isRequired', width: 12 },
      { header: 'Grupo (cenário)', key: 'group', width: 22 },
      { header: 'Mutex (escolha 1)', key: 'mutex', width: 22 },
    ];
    styleHeader(fieldsSheet.getRow(1));

    for (const t of sortedTemplates) {
      const fields = (t.requiredFieldsCache?.fields ?? []) as Array<{ key: string; label: string; type: string; isRequired?: boolean; group?: string | null; mutexGroup?: string | null }>;
      for (const f of fields) {
        fieldsSheet.addRow({
          tipology: tipologyName(t.tipologyId),
          iqiName: t.name ?? '',
          key: f.key,
          label: f.label,
          type: f.type,
          isRequired: f.isRequired === false ? 'Não' : 'Sim',
          group: f.group ?? '',
          mutex: f.mutexGroup ?? '',
        });
      }
    }

    // ─── Generate + stream ───────────────────────────────────────────────────
    const ab = await wb.xlsx.writeBuffer();
    const nodeBuffer = Buffer.from(ab as ArrayBuffer);
    const filename = `iqi-templates-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(nodeBuffer.length));
    res.send(nodeBuffer);
  }
}
