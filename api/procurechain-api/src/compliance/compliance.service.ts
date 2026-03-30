import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { COIStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import type { DeclareCOIDto, ReviewCOIDto } from './coi.dto';

type Ctx = { tenantId: string; companyId: string; userId?: string; roles?: string[] };

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: PolicyService,
  ) {}

  async declareCOI(ctx: Ctx, rfqId: string, dto: DeclareCOIDto) {
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id: rfqId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: { suppliers: true },
    });
    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (dto.supplierId) {
      const belongs = rfq.suppliers.some((s) => s.supplierId === dto.supplierId);
      if (!belongs) {
        throw new BadRequestException('supplierId must belong to this RFQ');
      }
    }

    const declaration = await this.prisma.cOIDeclaration.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        rfqId,
        supplierId: dto.supplierId,
        declaredBy: ctx.userId ?? 'dev-user',
        reason: dto.reason.trim(),
        status: COIStatus.PENDING,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'COI_DECLARED',
      entityType: 'COIDeclaration',
      entityId: declaration.id,
      payload: { rfqId, supplierId: dto.supplierId, reason: dto.reason },
    });

    return declaration;
  }

  async listCOI(ctx: Ctx, rfqId: string) {
    return this.prisma.cOIDeclaration.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, rfqId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewCOI(ctx: Ctx, declarationId: string, dto: ReviewCOIDto) {
    await this.policy.assertActionAllowed(ctx, 'COI_REVIEW');

    const declaration = await this.prisma.cOIDeclaration.findFirst({
      where: { id: declarationId, tenantId: ctx.tenantId, companyId: ctx.companyId },
    });
    if (!declaration) {
      throw new NotFoundException('COI declaration not found');
    }

    const status = dto.decision === 'APPROVED' ? COIStatus.APPROVED : COIStatus.BLOCKED;

    const updated = await this.prisma.cOIDeclaration.update({
      where: { id: declaration.id },
      data: {
        status,
        reviewedBy: ctx.userId ?? 'dev-user',
        reviewNotes: dto.reviewNotes,
        reviewedAt: new Date(),
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'COI_REVIEWED',
      entityType: 'COIDeclaration',
      entityId: declaration.id,
      payload: { decision: dto.decision, reviewNotes: dto.reviewNotes },
    });

    return updated;
  }

  async assertAwardAllowed(ctx: Ctx, rfqId: string, supplierId: string) {
    const blockers = await this.prisma.cOIDeclaration.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        rfqId,
        OR: [{ supplierId: null }, { supplierId }],
        status: { in: [COIStatus.PENDING, COIStatus.BLOCKED] },
      },
      select: { id: true, status: true },
    });

    if (blockers.length > 0) {
      await this.audit.record({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        actor: ctx.userId ?? 'dev-user',
        eventType: 'COI_AWARD_BLOCKED',
        entityType: 'RFQ',
        entityId: rfqId,
        payload: { supplierId, blockers },
      });

      throw new BadRequestException('Award blocked due to unresolved COI declarations');
    }
  }
}
