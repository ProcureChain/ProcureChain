import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AddSupplierContactDto,
  CreateSupplierDto,
  SetSupplierTagsDto,
  UpdateSupplierDto,
} from './supplier.dto';
import { PartnerAccessService } from '../partners/partner-access.service';
import { PartnerAccessScope } from '@prisma/client';

type AnyCtx = {
  tenantId: string;
  companyId: string;
  actorType?: 'USER' | 'PARTNER';
  partnerId?: string;
  partnerUserId?: string;
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly partnerAccess: PartnerAccessService,
  ) {}

  // -----------------------------
  // Partner boundary helpers
  // -----------------------------
  private isPartnerCtx(ctx: AnyCtx) {
    return ctx.actorType === 'PARTNER';
  }

  /**
   * Read access (partner must have active mapping, any scope ok)
   */
  private async enforceReadAccess(ctx: AnyCtx) {
    if (!this.isPartnerCtx(ctx)) return;

    if (!ctx.partnerId) {
      throw new ForbiddenException('Missing partner context');
    }

    await this.partnerAccess.requireTenantAccess({
      partnerId: ctx.partnerId,
      tenantId: ctx.tenantId,
      minScope: PartnerAccessScope.READ_ONLY,
    });
  }

  /**
   * Write access (partner must have SUPPORT or IMPLEMENTATION)
   */
  private async enforceWriteAccess(ctx: AnyCtx) {
    if (!this.isPartnerCtx(ctx)) return;

    if (!ctx.partnerId) {
      throw new ForbiddenException('Missing partner context');
    }

    await this.partnerAccess.requireTenantAccess({
      partnerId: ctx.partnerId,
      tenantId: ctx.tenantId,
      minScope: PartnerAccessScope.SUPPORT,
    });
  }

  // -----------------------------
  // CRUD
  // -----------------------------
  async create(ctx: AnyCtx, dto: CreateSupplierDto) {
    await this.enforceWriteAccess(ctx);

    if (!dto.name?.trim()) throw new BadRequestException('name is required');

    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: dto.name.trim(),
        legalName: dto.legalName,
        registrationNumber: dto.registrationNumber,
        vatNumber: dto.vatNumber,
        taxNumber: dto.taxNumber,
        status: dto.status ?? 'ACTIVE',
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address1: dto.address1,
        address2: dto.address2,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        country: dto.country ?? 'ZA',
        notes: dto.notes,

        externalRef: dto.externalRef,
        paymentTerms: dto.paymentTerms,
        leadTimeDays: dto.leadTimeDays,
        preferredCurrency: dto.preferredCurrency ?? 'ZAR',
        isPreferred: dto.isPreferred ?? false,
        profileScore: dto.profileScore ?? 70,
        complianceScore: dto.complianceScore ?? 70,
        deliveryScore: dto.deliveryScore ?? 70,
        qualityScore: dto.qualityScore ?? 70,
        riskScore: dto.riskScore ?? 70,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.isPartnerCtx(ctx) ? `partner:${ctx.partnerId ?? ctx.partnerUserId ?? 'unknown'}` : 'dev-user',
      eventType: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: supplier.id,
      payload: { name: supplier.name, status: supplier.status },
    });

    return supplier;
  }

  async list(ctx: AnyCtx, limit = 50, q?: string, subcategoryId?: string) {
    await this.enforceReadAccess(ctx);

    return this.prisma.supplier.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(subcategoryId ? { tags: { some: { subcategoryId } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
      include: { contacts: true, tags: { include: { subcategory: true } } },
    });
  }

  async get(ctx: AnyCtx, id: string) {
    await this.enforceReadAccess(ctx);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: { contacts: true, tags: { include: { subcategory: true } } },
    });

    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(ctx: AnyCtx, id: string, dto: UpdateSupplierDto) {
    await this.enforceWriteAccess(ctx);

    // tenant/company scope check
    await this.get(ctx, id);

    if (dto.name !== undefined && !dto.name?.trim()) {
      throw new BadRequestException('name cannot be empty');
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        legalName: dto.legalName,
        registrationNumber: dto.registrationNumber,
        vatNumber: dto.vatNumber,
        taxNumber: dto.taxNumber,
        status: dto.status,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address1: dto.address1,
        address2: dto.address2,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        country: dto.country,
        notes: dto.notes,

        externalRef: dto.externalRef,
        paymentTerms: dto.paymentTerms,
        leadTimeDays: dto.leadTimeDays,
        preferredCurrency: dto.preferredCurrency,
        isPreferred: dto.isPreferred,
        profileScore: dto.profileScore,
        complianceScore: dto.complianceScore,
        deliveryScore: dto.deliveryScore,
        qualityScore: dto.qualityScore,
        riskScore: dto.riskScore,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.isPartnerCtx(ctx) ? `partner:${ctx.partnerId ?? ctx.partnerUserId ?? 'unknown'}` : 'dev-user',
      eventType: 'SUPPLIER_UPDATED',
      entityType: 'Supplier',
      entityId: id,
      payload: { updatedFields: Object.keys(dto) },
    });

    return updated;
  }

  // -----------------------------
  // Contacts
  // -----------------------------
  async addContact(ctx: AnyCtx, supplierId: string, dto: AddSupplierContactDto) {
    await this.enforceWriteAccess(ctx);

    if (!dto.name?.trim()) throw new BadRequestException('contact name is required');

    // ensure tenant/company scoping
    await this.get(ctx, supplierId);

    if (dto.isPrimary) {
      // enforce single primary
      await this.prisma.supplierContact.updateMany({
        where: { supplierId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await this.prisma.supplierContact.create({
      data: {
        supplierId,
        name: dto.name.trim(),
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.isPartnerCtx(ctx) ? `partner:${ctx.partnerId ?? ctx.partnerUserId ?? 'unknown'}` : 'dev-user',
      eventType: 'SUPPLIER_CONTACT_ADDED',
      entityType: 'Supplier',
      entityId: supplierId,
      payload: { contactId: contact.id, name: contact.name, isPrimary: contact.isPrimary },
    });

    return contact;
  }

  async removeContact(ctx: AnyCtx, supplierId: string, contactId: string) {
    await this.enforceWriteAccess(ctx);

    // tenant/company scope check
    await this.get(ctx, supplierId);

    const contact = await this.prisma.supplierContact.findFirst({
      where: { id: contactId, supplierId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.prisma.supplierContact.delete({ where: { id: contactId } });

    // If primary removed, promote oldest remaining contact
    if (contact.isPrimary) {
      const next = await this.prisma.supplierContact.findFirst({
        where: { supplierId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.supplierContact.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.isPartnerCtx(ctx) ? `partner:${ctx.partnerId ?? ctx.partnerUserId ?? 'unknown'}` : 'dev-user',
      eventType: 'SUPPLIER_CONTACT_REMOVED',
      entityType: 'Supplier',
      entityId: supplierId,
      payload: { contactId, wasPrimary: contact.isPrimary },
    });

    return { ok: true };
  }

  // -----------------------------
  // Taxonomy tags
  // -----------------------------
  async setTags(ctx: AnyCtx, supplierId: string, dto: SetSupplierTagsDto) {
    await this.enforceWriteAccess(ctx);

    // ensure tenant/company scoping
    await this.get(ctx, supplierId);

    const ids = Array.from(new Set((dto.subcategoryIds ?? []).filter(Boolean)));
    if (ids.length === 0) {
      await this.prisma.supplierTaxonomyTag.deleteMany({ where: { supplierId } });

      await this.audit.record({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        actor: this.isPartnerCtx(ctx) ? `partner:${ctx.partnerId ?? ctx.partnerUserId ?? 'unknown'}` : 'dev-user',
        eventType: 'SUPPLIER_TAGS_SET',
        entityType: 'Supplier',
        entityId: supplierId,
        payload: { subcategoryIds: [] },
      });

      return { ok: true, subcategoryIds: [] };
    }

    // validate taxonomy IDs exist
    const found = await this.prisma.subcategory.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((x) => x.id));
    const missing = ids.filter((x) => !foundSet.has(x));
    if (missing.length) throw new BadRequestException(`Invalid subcategoryIds: ${missing.join(', ')}`);

    await this.prisma.$transaction([
      this.prisma.supplierTaxonomyTag.deleteMany({ where: { supplierId } }),
      this.prisma.supplierTaxonomyTag.createMany({
        data: ids.map((subcategoryId) => ({ supplierId, subcategoryId })),
        skipDuplicates: true,
      }),
    ]);

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.isPartnerCtx(ctx) ? `partner:${ctx.partnerId ?? ctx.partnerUserId ?? 'unknown'}` : 'dev-user',
      eventType: 'SUPPLIER_TAGS_SET',
      entityType: 'Supplier',
      entityId: supplierId,
      payload: { subcategoryIds: ids },
    });

    return { ok: true, subcategoryIds: ids };
  }
}
