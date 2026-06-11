import { Controller, Get, Param, ParseUUIDPipe, Query, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { AnalyticsService } from '../services/analytics.service';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** GET /api/admin/analytics/tickets — paginated table of per-ticket analyses.
   *  Filters: from/to dates, tipologyKey, decision (approved/corrected/rejected),
   *  rating (1-3), page, limit. ADMIN + SUPERVISOR. */
  @Get('tickets')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipologyKey') tipologyKey?: string,
    @Query('decision') decision?: 'approved' | 'corrected' | 'rejected',
    @Query('rating') rating?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.listTickets({
      from,
      to,
      tipologyKey,
      decision,
      rating: rating ? Number(rating) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** GET /api/admin/analytics/tickets/export — XLSX of ALL tickets matching the
   *  filters (no pagination), with the full treatment data: complaint text, AI
   *  analysis, compliance, response, evaluation, decision. ADMIN + SUPERVISOR.
   *  Declared before tickets/:id so the literal path wins over the param route. */
  @Get('tickets/export')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async export(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipologyKey') tipologyKey?: string,
    @Query('decision') decision?: 'approved' | 'corrected' | 'rejected',
    @Query('rating') rating?: string,
  ): Promise<void> {
    const rows = await this.analytics.exportRows({
      from,
      to,
      tipologyKey,
      decision,
      rating: rating ? Number(rating) : undefined,
    });

    const decisionLabel = (d: unknown): string =>
      d === 'approved' ? 'Aprovado' : d === 'corrected' ? 'Corrigido' : d === 'rejected' ? 'Reprovado' : '—';
    const riskLabel = (r: unknown): string =>
      r === 'critical' ? 'Crítico' : r === 'high' ? 'Alto' : r === 'medium' ? 'Médio' : r === 'low' ? 'Baixo' : '—';
    const fmtDate = (v: unknown): string => {
      if (!v) return '';
      const d = v instanceof Date ? v : new Date(String(v));
      return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
    };
    const fmtDuration = (ms: unknown): string => {
      if (ms == null || isNaN(Number(ms))) return '';
      const totalSec = Math.round(Number(ms) / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${min}m ${sec}s`;
    };
    const threats = (r: Record<string, unknown>): string =>
      [r.has_legal_threat ? 'jurídico' : null, r.has_social_media_threat ? 'mídia' : null, r.has_prior_complaints ? 'reincidente' : null]
        .filter(Boolean)
        .join(', ');
    const violations = (v: unknown): string => {
      if (!Array.isArray(v) || v.length === 0) return '';
      return v.map((x: any) => x?.rule ?? x?.message ?? x?.fieldLabel ?? JSON.stringify(x)).join(' | ');
    };
    // Responses are stored as rich-text HTML from the editor; XLSX cells need plain text.
    const stripHtml = (v: unknown): string => {
      if (!v) return '';
      return String(v)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'BKO Agent';
    wb.created = new Date();
    const ws = wb.addWorksheet('Análises');
    ws.columns = [
      { header: 'Protocolo', key: 'protocolo', width: 20 },
      { header: 'Data reclamação', key: 'data', width: 18 },
      { header: 'Tipologia', key: 'tipologia', width: 24 },
      { header: 'Risco', key: 'risco', width: 10 },
      { header: 'Reclamação', key: 'reclamacao', width: 60 },
      { header: 'Propensão IA (%)', key: 'propensao', width: 14 },
      { header: 'Tom (IA)', key: 'tom', width: 16 },
      { header: 'Ameaças (IA)', key: 'ameacas', width: 22 },
      { header: 'Confiança tipologia (IA)', key: 'conf', width: 20 },
      { header: 'IQI usado', key: 'iqi', width: 28 },
      { header: 'Conformidade (%)', key: 'conf_pct', width: 16 },
      { header: 'Conforme?', key: 'conforme', width: 12 },
      { header: 'Violações', key: 'violacoes', width: 40 },
      { header: 'Resposta IA (original)', key: 'resposta_ia', width: 60 },
      { header: 'Resposta final', key: 'resposta', width: 60 },
      { header: 'Avaliação IA (1-3)', key: 'avaliacao', width: 16 },
      { header: 'Resultado', key: 'resultado', width: 14 },
      { header: 'TMT', key: 'tmt', width: 14 },
      { header: 'Tempo 1ª tela', key: 'tempo_tela1', width: 14 },
      { header: 'Tempo 2ª tela', key: 'tempo_tela2', width: 14 },
      { header: 'Operador', key: 'operador', width: 24 },
      { header: 'Revisado em', key: 'revisado', width: 18 },
    ];
    const header = ws.getRow(1);
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    });
    header.height = 22;

    for (const r of rows as Record<string, unknown>[]) {
      ws.addRow({
        protocolo: r.protocol_number ?? '',
        data: fmtDate(r.data_documento),
        tipologia: (r.tipology_label ?? r.tipology_key ?? '—') as string,
        risco: riskLabel(r.risk_level),
        reclamacao: (r.raw_text ?? '') as string,
        propensao: r.propensity_score != null ? Math.round(Number(r.propensity_score)) : '',
        tom: (r.emotional_tone ?? '') as string,
        ameacas: threats(r),
        conf: r.tipology_confidence != null ? `${Math.round(Number(r.tipology_confidence) * 100)}%` : '',
        iqi: (r.iqi_template_name ?? '') as string,
        conf_pct: r.compliance_score != null ? Math.round(Number(r.compliance_score) * 100) : '',
        conforme: r.is_compliant == null ? '' : r.is_compliant ? 'Sim' : 'Não',
        violacoes: violations(r.violations),
        resposta_ia: stripHtml(r.ai_response_text),
        resposta: stripHtml(r.response_text),
        avaliacao: r.rating != null ? Number(r.rating) : '',
        resultado: decisionLabel(r.decision),
        tmt: fmtDuration(r.tmt_ms),
        tempo_tela1: fmtDuration(r.first_screen_ms),
        tempo_tela2: fmtDuration(r.second_screen_ms),
        operador: (r.reviewer_name ?? '') as string,
        revisado: fmtDate(r.reviewed_at),
      });
    }
    ws.getColumn('reclamacao').alignment = { wrapText: true, vertical: 'top' };
    ws.getColumn('resposta_ia').alignment = { wrapText: true, vertical: 'top' };
    ws.getColumn('resposta').alignment = { wrapText: true, vertical: 'top' };

    const ab = await wb.xlsx.writeBuffer();
    const nodeBuffer = Buffer.from(ab);
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="analises-${today}.xlsx"`);
    res.setHeader('Content-Length', String(nodeBuffer.length));
    res.end(nodeBuffer);
  }

  /** GET /api/admin/analytics/tickets/:id — full drill-down for a single ticket.
   *  OPERATOR can also access individual ticket detail (used by /processar to
   *  show a read-only view when the operator searches a completed protocol).
   *  The list endpoint above stays ADMIN+SUPERVISOR only. */
  @Get('tickets/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.analytics.getTicketDetail(id);
    if (!data) throw new NotFoundException(`Ticket ${id} not found`);
    return data;
  }

  /** GET /api/admin/analytics/tipologies — distinct tipologies for the filter
   *  dropdown. Returns active tipologies only. */
  @Get('tipologies')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  tipologies() {
    return this.analytics.listTipologyOptions();
  }
}
