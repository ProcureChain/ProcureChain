import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ExportFormat, ExportType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type Ctx = { tenantId: string; companyId: string; userId?: string };

type ExportRow = Record<string, string | number | boolean | null>;

function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function stableStringifyLegacy(value: unknown): string {
  const isoTs = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (typeof value === 'string' && isoTs.test(value)) return '{}';
  if (value instanceof Date) return '{}';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringifyLegacy(v)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringifyLegacy(obj[k])}`).join(',')}}`;
}

function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return 'no_data\n';
  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = [...headerSet].sort();
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async generateExport(ctx: Ctx, exportType: ExportType, format: ExportFormat = 'CSV') {
    const rows = await this.buildRows(ctx, exportType);
    const content = this.renderContent(exportType, format, rows);
    const contentHash = createHash('sha256').update(content).digest('hex');

    const record = await this.prisma.governmentExport.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        exportType,
        format,
        contentHash,
        rowCount: rows.length,
        payload: {
          rows,
          content,
        },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'GOV_EXPORT_GENERATED',
      entityType: 'GovernmentExport',
      entityId: record.id,
      payload: { exportType, format, rowCount: rows.length, contentHash },
    });

    return {
      id: record.id,
      exportType,
      format,
      rowCount: rows.length,
      hashReference: `sha256:${contentHash}`,
      content,
    };
  }

  async listExports(ctx: Ctx, limit = 50) {
    return this.prisma.governmentExport.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async getRetentionPolicy(ctx: Ctx) {
    return this.prisma.retentionPolicy.upsert({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
      update: {},
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    });
  }

  async updateRetentionPolicy(ctx: Ctx, dto: { auditRetentionDays?: number; enforceImmutability?: boolean; allowPurge?: boolean }) {
    const policy = await this.getRetentionPolicy(ctx);
    if (dto.auditRetentionDays != null && dto.auditRetentionDays < 30) {
      throw new BadRequestException('auditRetentionDays must be at least 30');
    }

    const updated = await this.prisma.retentionPolicy.update({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
      data: {
        auditRetentionDays: dto.auditRetentionDays,
        enforceImmutability: dto.enforceImmutability,
        allowPurge: dto.allowPurge,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RETENTION_POLICY_UPDATED',
      entityType: 'RetentionPolicy',
      entityId: updated.id,
      payload: dto,
    });

    return updated;
  }

  async runRetention(ctx: Ctx, dryRun = true) {
    const policy = await this.getRetentionPolicy(ctx);
    const cutoffTs = new Date(Date.now() - Number(policy.auditRetentionDays) * 24 * 60 * 60 * 1000);

    const eligibleWhere = {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      ts: { lt: cutoffTs },
    };

    const eligibleCount = await this.prisma.auditEvent.count({ where: eligibleWhere });

    let purgedCount = 0;
    let mode = 'CHECK_ONLY';
    if (!dryRun && policy.allowPurge) {
      const out = await this.prisma.auditEvent.deleteMany({
        where: {
          ...eligibleWhere,
          immutable: false,
        },
      });
      purgedCount = out.count;
      mode = 'PURGE_MUTABLE_ONLY';
    }

    const run = await this.prisma.retentionRunLog.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        cutoffTs,
        eligibleCount,
        purgedCount,
        mode,
        summary: {
          dryRun,
          allowPurge: policy.allowPurge,
          enforceImmutability: policy.enforceImmutability,
        },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RETENTION_RUN_EXECUTED',
      entityType: 'RetentionRunLog',
      entityId: run.id,
      payload: { cutoffTs, eligibleCount, purgedCount, mode },
    });

    return run;
  }

  async listRetentionRuns(ctx: Ctx, limit = 50) {
    return this.prisma.retentionRunLog.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async verifyAuditEvidence(ctx: Ctx, limit = 500) {
    const events = await this.prisma.auditEvent.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, eventHash: { not: null } },
      orderBy: [{ ts: 'asc' }, { id: 'asc' }],
      take: Math.max(1, Math.min(limit, 5000)),
    });

    let prevHash: string | null = null;
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i];
      const canonical = stableStringify({
        tenantId: e.tenantId,
        companyId: e.companyId,
        actor: e.actor ?? null,
        eventType: e.eventType,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        payload: e.payload ?? null,
        prevEventHash: prevHash,
      });
      const expected = createHash('sha256').update(canonical).digest('hex');
      const legacyCanonical = stableStringifyLegacy({
        tenantId: e.tenantId,
        companyId: e.companyId,
        actor: e.actor ?? null,
        eventType: e.eventType,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        payload: e.payload ?? null,
        prevEventHash: prevHash,
      });
      const expectedLegacy = createHash('sha256').update(legacyCanonical).digest('hex');

      const hashMatches = (e.eventHash ?? null) === expected || (e.eventHash ?? null) === expectedLegacy;
      if ((e.prevEventHash ?? null) !== prevHash || !hashMatches) {
        return {
          valid: false,
          checked: i + 1,
          brokenEventId: e.id,
          expectedPrevHash: prevHash,
          actualPrevHash: e.prevEventHash ?? null,
          expectedHash: expected,
          actualHash: e.eventHash ?? null,
        };
      }
      prevHash = e.eventHash ?? null;
    }

    return {
      valid: true,
      checked: events.length,
      lastHash: prevHash,
    };
  }

  private renderContent(exportType: ExportType, format: ExportFormat, rows: ExportRow[]) {
    if (format === 'CSV') {
      return toCsv(rows);
    }

    const lines = [
      `PROCURECHAIN ${exportType} PDF SNAPSHOT`,
      `row_count=${rows.length}`,
      '',
      ...rows.map((r) => stableStringify(r)),
    ];

    return `${lines.join('\n')}\n`;
  }

  private async buildRows(ctx: Ctx, exportType: ExportType): Promise<ExportRow[]> {
    switch (exportType) {
      case 'TENDER_REGISTER': {
        const rfqs = await this.prisma.rFQ.findMany({
          where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
          include: { pr: true, award: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        return rfqs.map((r) => ({
          rfqId: r.id,
          prId: r.prId,
          status: r.status,
          procurementMethod: r.procurementMethod,
          procurementBand: r.procurementBand,
          isEmergency: r.isEmergency,
          releasedAt: r.releasedAt?.toISOString() ?? null,
          openedAt: r.openedAt?.toISOString() ?? null,
          closedAt: r.closedAt?.toISOString() ?? null,
          awardId: r.award?.id ?? null,
        }));
      }
      case 'BID_OPENING_RECORD': {
        const rows = await this.prisma.bid.findMany({
          where: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            status: { in: ['SUBMITTED', 'OPENED', 'UNDER_EVALUATION', 'SHORTLISTED', 'AWARD_RECOMMENDED', 'CLOSED', 'REJECTED'] },
          },
          include: { rfq: true, supplier: true },
          orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        });
        return rows.map((x) => ({
          bidId: x.id,
          rfqId: x.rfqId,
          supplierId: x.supplierId,
          supplierName: x.supplier.name,
          bidStatus: x.status,
          submittedAt: x.submittedAt?.toISOString() ?? null,
          openedAt: x.openedAt?.toISOString() ?? null,
          totalBidValue: x.totalBidValue?.toString() ?? null,
        }));
      }
      case 'EVALUATION_PACK': {
        const bids = await this.prisma.bid.findMany({
          where: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            status: { in: ['UNDER_EVALUATION', 'SHORTLISTED', 'AWARD_RECOMMENDED', 'CLOSED', 'REJECTED'] },
          },
          include: { rfq: true, supplier: true, scores: true },
          orderBy: [{ finalScore: 'desc' }, { submittedAt: 'asc' }, { id: 'asc' }],
        });
        return bids.map((b) => ({
          bidId: b.id,
          rfqId: b.rfqId,
          supplierId: b.supplierId,
          supplierName: b.supplier.name,
          bidStatus: b.status,
          finalScore: b.finalScore?.toString() ?? null,
          recommended: b.recommended,
          recommendationReason: b.recommendationReason ?? null,
          scoreCount: b.scores.length,
          evaluationSummary: b.evaluationSummary ? stableStringify(b.evaluationSummary) : null,
        }));
      }
      case 'AWARD_REPORT_NOTICE': {
        const awards = await this.prisma.rFQAward.findMany({
          where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
          include: { rfq: true, supplier: true },
          orderBy: [{ awardedAt: 'asc' }, { id: 'asc' }],
        });
        return awards.map((a) => ({
          noticeId: `AWARD-${a.id}`,
          rfqId: a.rfqId,
          supplierName: a.supplier.name,
          awardedAt: a.awardedAt.toISOString(),
          status: a.rfq.status,
        }));
      }
      case 'COI_REGISTER': {
        const coi = await this.prisma.cOIDeclaration.findMany({
          where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
          include: { supplier: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        return coi.map((c) => ({
          coiId: c.id,
          rfqId: c.rfqId,
          supplierId: c.supplierId,
          supplierName: c.supplier?.name ?? null,
          status: c.status,
          declaredBy: c.declaredBy,
          reviewedBy: c.reviewedBy ?? null,
          reviewedAt: c.reviewedAt?.toISOString() ?? null,
        }));
      }
      case 'RETENTION_LOG': {
        const runs = await this.prisma.retentionRunLog.findMany({
          where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        return runs.map((r) => ({
          runId: r.id,
          cutoffTs: r.cutoffTs.toISOString(),
          eligibleCount: r.eligibleCount,
          purgedCount: r.purgedCount,
          mode: r.mode,
          createdAt: r.createdAt.toISOString(),
        }));
      }
      default:
        throw new BadRequestException(`Unsupported export type: ${exportType}`);
    }
  }
}
