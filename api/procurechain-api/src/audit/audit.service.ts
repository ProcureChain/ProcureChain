import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(evt: {
    tenantId: string;
    companyId: string;
    actor?: string;
    eventType: string;
    entityType?: string;
    entityId?: string;
    payload?: any;
  }) {
    const previous = await this.prisma.auditEvent.findFirst({
      where: { tenantId: evt.tenantId, companyId: evt.companyId },
      orderBy: [{ ts: 'desc' }, { id: 'desc' }],
      select: { eventHash: true },
    });

    const canonical = stableStringify({
      tenantId: evt.tenantId,
      companyId: evt.companyId,
      actor: evt.actor ?? null,
      eventType: evt.eventType,
      entityType: evt.entityType ?? null,
      entityId: evt.entityId ?? null,
      payload: evt.payload ?? null,
      prevEventHash: previous?.eventHash ?? null,
    });
    const eventHash = createHash('sha256').update(canonical).digest('hex');

    return this.prisma.auditEvent.create({
      data: {
        tenantId: evt.tenantId,
        companyId: evt.companyId,
        actor: evt.actor,
        eventType: evt.eventType,
        entityType: evt.entityType,
        entityId: evt.entityId,
        payload: evt.payload ?? undefined,
        prevEventHash: previous?.eventHash ?? undefined,
        eventHash,
        immutable: true,
      },
    });
  }

  async list(
    tenantId: string,
    companyId: string,
    params?: { limit?: number; entityType?: string; entityId?: string },
  ) {
    return this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        companyId,
        ...(params?.entityType ? { entityType: params.entityType } : {}),
        ...(params?.entityId ? { entityId: params.entityId } : {}),
      },
      orderBy: { ts: 'desc' },
      take: Math.max(1, Math.min(params?.limit ?? 50, 300)),
    });
  }
}
