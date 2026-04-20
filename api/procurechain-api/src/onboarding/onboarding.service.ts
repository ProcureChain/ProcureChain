import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  LoginDto,
  OrganizationSignupDto,
  SupplierSignupDto,
  UpdateOrganizationProfileDto,
  UploadOrganizationDocumentDto,
  UploadSupplierDocumentDto,
} from './onboarding.dto';

type UploadedBinary = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

type Ctx = {
  tenantId: string;
  companyId: string;
  userId?: string;
  roles?: string[];
};

@Injectable()
export class OnboardingService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'organization-documents');
  private readonly supplierUploadsDir = join(process.cwd(), 'uploads', 'supplier-documents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashPassword(password: string) {
    const normalized = password.trim();
    if (normalized.length < 8) {
      throw new BadRequestException('password must be at least 8 characters');
    }
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(normalized, salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
  }

  private verifyPassword(password: string, passwordHash?: string | null) {
    if (!passwordHash) return false;
    const [algorithm, salt, stored] = passwordHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !stored) return false;
    const derived = scryptSync(password.trim(), salt, 64);
    const storedBuffer = Buffer.from(stored, 'hex');
    if (storedBuffer.length !== derived.length) return false;
    return timingSafeEqual(derived, storedBuffer);
  }

  private getPublicSupplierScope() {
    return {
      tenantId: process.env.PUBLIC_SIGNUP_TENANT_ID?.trim() || 'dev-tenant',
      companyId: process.env.PUBLIC_SIGNUP_COMPANY_ID?.trim() || 'dev-company',
    };
  }

  private scoreSupplier(dto: SupplierSignupDto) {
    const experienceRaw = Math.round(
      ((Math.min(dto.yearsInOperation ?? 0, 15) / 15) * 60) +
        ((Math.min(dto.completedProjects ?? 0, 100) / 100) * 40),
    );
    const capacityRaw = Math.round(
      ((Math.min(dto.maxOrderValue ?? 0, 5_000_000) / 5_000_000) * 60) +
        ((Math.max(0, 60 - Math.min(dto.leadTimeDays ?? 60, 60)) / 60) * 40),
    );
    const qualityRaw = Math.round(
      (Math.min((dto.certifications ?? []).length, 4) / 4) * 70 +
        ((dto.hasQualityControlProcess ? 1 : 0) * 30),
    );
    const reliabilityRaw = Math.round(
      Math.max(0, Math.min(100, dto.onTimeDeliveryRate ?? 0)) * 0.8 +
        ((dto.disputeHistory ? 0 : 1) * 20),
    );
    const serviceRaw = Math.round(
      ((Math.max(0, 72 - Math.min(dto.responseTimeHours ?? 72, 72)) / 72) * 60) +
        ((dto.dedicatedAccountManager ? 1 : 0) * 40),
    );
    const pricingRaw =
      dto.pricingPosition === 'BUDGET'
        ? 90
        : dto.pricingPosition === 'MARKET'
          ? 75
          : dto.pricingPosition === 'PREMIUM'
            ? 55
            : 50;

    const weightedScore = Math.round(
      experienceRaw * 0.2 +
        capacityRaw * 0.15 +
        qualityRaw * 0.25 +
        reliabilityRaw * 0.2 +
        serviceRaw * 0.1 +
        pricingRaw * 0.1,
    );

    const tier = weightedScore >= 80 ? 'GOLD' : weightedScore >= 65 ? 'SILVER' : 'BRONZE';

    return {
      weightedScore,
      tier,
      breakdown: {
        experience: experienceRaw,
        capacity: capacityRaw,
        qualityCompliance: qualityRaw,
        reliability: reliabilityRaw,
        customerService: serviceRaw,
        pricingCompetitiveness: pricingRaw,
        weights: {
          experience: 20,
          capacity: 15,
          qualityCompliance: 25,
          reliability: 20,
          customerService: 10,
          pricingCompetitiveness: 10,
        },
      },
    };
  }

  private async storeDocumentFile(companyId: string, file?: UploadedBinary) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    // TODO: move organization verification documents to object/blob storage in production.
    await mkdir(this.uploadsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${companyId}-${Date.now()}-${safeName}`;
    const storedPath = join(this.uploadsDir, storedName);
    await writeFile(storedPath, file.buffer);

    return {
      storagePath: storedPath,
      originalName: safeName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private async storeSupplierDocumentFile(supplierId: string, file?: UploadedBinary) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    // TODO: move supplier verification documents to object/blob storage in production.
    await mkdir(this.supplierUploadsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${supplierId}-${Date.now()}-${safeName}`;
    const storedPath = join(this.supplierUploadsDir, storedName);
    await writeFile(storedPath, file.buffer);

    return {
      storagePath: storedPath,
      originalName: safeName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private requireSupplierCtx(ctx: Ctx & { partnerId?: string; actorType?: string }) {
    if (ctx.actorType !== 'PARTNER' || !ctx.partnerId) {
      throw new BadRequestException('Supplier context is required');
    }
    return ctx.partnerId;
  }

  async signupOrganization(dto: OrganizationSignupDto) {
    const companyName = dto.companyName?.trim();
    const fullName = dto.fullName?.trim();
    const workEmail = this.normalizeEmail(dto.workEmail ?? '');

    if (!companyName) {
      throw new BadRequestException('companyName is required');
    }
    if (!fullName) {
      throw new BadRequestException('fullName is required');
    }
    if (!workEmail) {
      throw new BadRequestException('workEmail is required');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: workEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new BadRequestException('An account already exists for this work email');
    }

    const tenantId = randomUUID();
    const companyId = randomUUID();
    const userId = randomUUID();
    const defaultRoles = [
      'SUPERADMIN',
      'PROCUREMENT_OFFICER',
      'PROCUREMENT_MANAGER',
      'FINANCE_MANAGER',
      'COMPLIANCE_OFFICER',
    ];

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: companyName,
        },
      });

      const company = await tx.company.create({
        data: {
          id: companyId,
          tenantId,
          name: companyName,
        },
      });

      const user = await tx.user.create({
        data: {
          id: userId,
          tenantId,
          companyId,
          email: workEmail,
          passwordHash: this.hashPassword(dto.password),
          roles: defaultRoles,
        },
      });

      const profile = await tx.organizationProfile.create({
        data: {
          tenantId,
          companyId,
          registrationNumber: dto.registrationNumber?.trim() || null,
          industry: dto.industry?.trim() || null,
          country: dto.country?.trim() || 'ZA',
          companySize: dto.companySize?.trim() || null,
          contactFullName: fullName,
          workEmail,
          phoneNumber: dto.phoneNumber?.trim() || null,
          role: dto.role?.trim() || null,
          monthlyProcurementSpendRange: dto.monthlyProcurementSpendRange?.trim() || null,
          mainCategoriesPurchased: (dto.mainCategoriesPurchased ?? []).map((value) => value.trim()).filter(Boolean),
          supplierCountRange: dto.numberOfSuppliersCurrentlyUsed?.trim() || null,
          usesProcurementSystem: dto.usesProcurementSystemToday ?? null,
          verificationStatus: 'PENDING',
        },
      });

      return { tenant, company, user, profile };
    });

    await this.audit.record({
      tenantId,
      companyId,
      actor: workEmail,
      eventType: 'ORG_SIGNUP_CREATED',
      entityType: 'OrganizationProfile',
      entityId: created.profile.id,
      payload: {
        companyName,
        registrationNumber: created.profile.registrationNumber,
        industry: created.profile.industry,
        mainCategoriesPurchased: created.profile.mainCategoriesPurchased,
      },
    });

    return {
      tenantId,
      companyId,
      userId,
      email: created.user.email,
      roles: created.user.roles,
      verificationStatus: created.profile.verificationStatus,
      nextSteps: {
        canCreatePrDraft: true,
        canReleaseRfq: false,
        verificationDocumentsRequired: [
          'company_registration_certificate',
          'tax_vat_certificate',
          'bank_confirmation_letter',
        ],
      },
    };
  }

  async signupSupplier(dto: SupplierSignupDto) {
    const companyName = dto.companyName?.trim();
    const workEmail = this.normalizeEmail(dto.workEmail ?? '');
    if (!companyName) {
      throw new BadRequestException('companyName is required');
    }
    if (!workEmail) {
      throw new BadRequestException('workEmail is required');
    }
    if (!Array.isArray(dto.subcategoryIds) || dto.subcategoryIds.length < 1) {
      throw new BadRequestException('At least one subcategoryId is required');
    }

    const scope = this.getPublicSupplierScope();
    const company = await this.prisma.company.findFirst({
      where: { id: scope.companyId, tenantId: scope.tenantId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!company) {
      throw new NotFoundException('Public supplier onboarding scope is not configured');
    }

    const normalizedSubcategoryIds = [...new Set(dto.subcategoryIds.map((value) => value.trim()).filter(Boolean))];
    const validSubcategories = await this.prisma.subcategory.findMany({
      where: { id: { in: normalizedSubcategoryIds } },
      select: { id: true },
    });
    if (validSubcategories.length !== normalizedSubcategoryIds.length) {
      const validIds = new Set(validSubcategories.map((row) => row.id));
      const missing = normalizedSubcategoryIds.filter((id) => !validIds.has(id));
      throw new BadRequestException(`Invalid subcategoryIds: ${missing.join(', ')}`);
    }

    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        tenantId: scope.tenantId,
        companyId: scope.companyId,
        email: workEmail,
      },
      select: { id: true },
    });
    if (existingSupplier) {
      throw new BadRequestException('A supplier already exists for this work email');
    }

    const scoring = this.scoreSupplier(dto);
    const questionnaire = {
      completedProjects: dto.completedProjects ?? null,
      maxOrderValue: dto.maxOrderValue ?? null,
      leadTimeDays: dto.leadTimeDays ?? null,
      certifications: dto.certifications ?? [],
      hasQualityControlProcess: dto.hasQualityControlProcess ?? false,
      responseTimeHours: dto.responseTimeHours ?? null,
      dedicatedAccountManager: dto.dedicatedAccountManager ?? false,
      onTimeDeliveryRate: dto.onTimeDeliveryRate ?? null,
      disputeHistory: dto.disputeHistory ?? false,
      pricingPosition: dto.pricingPosition ?? null,
    };

    const supplier = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          tenantId: scope.tenantId,
          companyId: scope.companyId,
          name: companyName,
          legalName: companyName,
          registrationNumber: dto.registrationNumber?.trim() || null,
          status: 'ACTIVE',
          email: workEmail,
          passwordHash: this.hashPassword(dto.password),
          phone: dto.phoneNumber?.trim() || null,
          website: dto.website?.trim() || null,
          country: 'ZA',
          leadTimeDays: dto.leadTimeDays ?? null,
          profileScore: scoring.weightedScore,
          complianceScore: scoring.breakdown.qualityCompliance,
          deliveryScore: scoring.breakdown.reliability,
          qualityScore: scoring.breakdown.qualityCompliance,
          riskScore: Math.max(0, 100 - scoring.breakdown.reliability),
        },
      });

      if (dto.fullName?.trim()) {
        await tx.supplierContact.create({
          data: {
            supplierId: created.id,
            name: dto.fullName.trim(),
            email: workEmail,
            phone: dto.phoneNumber?.trim() || null,
            role: 'Primary Contact',
            isPrimary: true,
          },
        });
      }

      await tx.supplierTaxonomyTag.createMany({
        data: normalizedSubcategoryIds.map((subcategoryId) => ({
          supplierId: created.id,
          subcategoryId,
        })),
        skipDuplicates: true,
      });

      await tx.supplierOnboardingProfile.create({
        data: {
          tenantId: scope.tenantId,
          companyId: scope.companyId,
          supplierId: created.id,
          yearsInOperation: dto.yearsInOperation ?? null,
          employeeCountRange: dto.numberOfEmployees?.trim() || null,
          regionsServed: (dto.regionsServed ?? []).map((value) => value.trim()).filter(Boolean),
          selectedCategoryIds: (dto.categoryIds ?? []).map((value) => value.trim()).filter(Boolean),
          questionnaire,
          scoreBreakdown: scoring.breakdown,
          tier: scoring.tier as 'BRONZE' | 'SILVER' | 'GOLD',
          verificationStatus: 'PENDING',
        },
      });

      return created;
    });

    await this.audit.record({
      tenantId: scope.tenantId,
      companyId: scope.companyId,
      actor: workEmail,
      eventType: 'SUPPLIER_SIGNUP_CREATED',
      entityType: 'Supplier',
      entityId: supplier.id,
      payload: {
        companyName,
        subcategoryIds: normalizedSubcategoryIds,
        profileScore: scoring.weightedScore,
        tier: scoring.tier,
      },
    });

    return {
      tenantId: scope.tenantId,
      companyId: scope.companyId,
      supplierId: supplier.id,
      profileScore: scoring.weightedScore,
      tier: scoring.tier,
      verificationStatus: 'PENDING',
      nextSteps: {
        canBid: true,
        documentsRequired: [
          'company_registration_certificate',
          'tax_vat_certificate',
          'bank_confirmation_letter',
        ],
      },
    };
  }

  async getOrganizationProfile(ctx: Ctx) {
    const profile = await this.prisma.organizationProfile.findUnique({
      where: { companyId: ctx.companyId },
    });

    if (!profile || profile.tenantId !== ctx.tenantId) {
      throw new NotFoundException('Organization profile not found');
    }

    const company = await this.prisma.company.findFirst({
      where: { id: ctx.companyId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });

    return {
      ...profile,
      companyName: company?.name ?? null,
    };
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    if (!identifier) {
      throw new BadRequestException('identifier is required');
    }

    if (dto.portal === 'organization') {
      const user = await this.prisma.user.findFirst({
        where: {
          email: identifier,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
        throw new ForbiddenException('Invalid email or password');
      }

      const profile = await this.prisma.organizationProfile.findUnique({
        where: { companyId: user.companyId },
        select: {
          contactFullName: true,
          workEmail: true,
        },
      });

      const actorName =
        profile?.contactFullName?.trim() ||
        profile?.workEmail?.split('@')[0] ||
        user.email?.split('@')[0] ||
        'Organization User';

      return {
        portal: 'organization' as const,
        tenantId: user.tenantId,
        companyId: user.companyId,
        actorId: user.id,
        actorName,
        actorRoles: user.roles,
      };
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        OR: [
          { email: identifier },
          { name: dto.identifier.trim() },
        ],
      },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!supplier || !this.verifyPassword(dto.password, supplier.passwordHash)) {
      throw new ForbiddenException('Invalid email or password');
    }

    const actorName = supplier.contacts[0]?.name?.trim() || supplier.name;

    return {
      portal: 'supplier' as const,
      tenantId: supplier.tenantId,
      companyId: supplier.companyId,
      actorId: `supplier-${supplier.id}`,
      actorName,
      actorRoles: ['SUPPLIER'],
      supplierId: supplier.id,
    };
  }

  async getSupplierProfile(ctx: Ctx & { partnerId?: string; actorType?: string }) {
    const supplierId = this.requireSupplierCtx(ctx);
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        tags: {
          include: {
            subcategory: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        onboardingProfile: true,
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier profile not found');
    }

    return supplier;
  }

  async updateOrganizationProfile(ctx: Ctx, dto: UpdateOrganizationProfileDto) {
    await this.getOrganizationProfile(ctx);

    if (dto.workEmail) {
      const normalizedEmail = this.normalizeEmail(dto.workEmail);
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
          },
        },
        select: { id: true },
      });
      if (existingUser) {
        throw new BadRequestException('Another account already uses this work email');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.companyName?.trim()) {
        await tx.company.update({
          where: { id: ctx.companyId },
          data: { name: dto.companyName.trim() },
        });
      }

      if (dto.workEmail?.trim()) {
        await tx.user.updateMany({
          where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
          data: { email: this.normalizeEmail(dto.workEmail) },
        });
      }

      return tx.organizationProfile.update({
        where: { companyId: ctx.companyId },
        data: {
          registrationNumber: dto.registrationNumber?.trim(),
          industry: dto.industry?.trim(),
          country: dto.country?.trim(),
          companySize: dto.companySize?.trim(),
          contactFullName: dto.fullName?.trim(),
          workEmail: dto.workEmail ? this.normalizeEmail(dto.workEmail) : undefined,
          phoneNumber: dto.phoneNumber?.trim(),
          role: dto.role?.trim(),
          monthlyProcurementSpendRange: dto.monthlyProcurementSpendRange?.trim(),
          mainCategoriesPurchased: dto.mainCategoriesPurchased
            ? dto.mainCategoriesPurchased.map((value) => value.trim()).filter(Boolean)
            : undefined,
          supplierCountRange: dto.numberOfSuppliersCurrentlyUsed?.trim(),
          usesProcurementSystem:
            dto.usesProcurementSystemToday === undefined ? undefined : dto.usesProcurementSystemToday,
          verificationStatus: dto.verificationStatus,
          verifiedAt: dto.verificationStatus === 'VERIFIED' ? new Date() : undefined,
          verifiedBy: dto.verificationStatus === 'VERIFIED' ? (ctx.userId ?? 'dev-user') : undefined,
        },
      });
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'ORG_PROFILE_UPDATED',
      entityType: 'OrganizationProfile',
      entityId: updated.id,
      payload: {
        updatedFields: Object.keys(dto),
        verificationStatus: updated.verificationStatus,
      },
    });

    return this.getOrganizationProfile(ctx);
  }

  async listOrganizationDocuments(ctx: Ctx) {
    return this.prisma.organizationDocument.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async uploadOrganizationDocument(
    ctx: Ctx,
    dto: UploadOrganizationDocumentDto,
    file?: UploadedBinary,
  ) {
    await this.getOrganizationProfile(ctx);
    const stored = await this.storeDocumentFile(ctx.companyId, file);

    const document = await this.prisma.organizationDocument.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        fieldKey: dto.fieldKey.trim(),
        label: dto.label?.trim() || null,
        originalName: stored.originalName,
        mimeType: stored.mimeType ?? null,
        sizeBytes: stored.sizeBytes ?? null,
        storagePath: stored.storagePath,
      },
    });

    await this.prisma.organizationProfile.update({
      where: { companyId: ctx.companyId },
      data: {
        verificationStatus: 'UNDER_REVIEW',
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'ORG_VERIFICATION_DOCUMENT_UPLOADED',
      entityType: 'OrganizationProfile',
      entityId: ctx.companyId,
      payload: {
        documentId: document.id,
        fieldKey: document.fieldKey,
        originalName: document.originalName,
      },
    });

    return document;
  }

  async downloadOrganizationDocument(ctx: Ctx, documentId: string, res: Response) {
    const document = await this.prisma.organizationDocument.findFirst({
      where: {
        id: documentId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    });

    if (!document) {
      throw new NotFoundException('Organization document not found');
    }

    const file = await readFile(document.storagePath);
    res.setHeader('content-type', document.mimeType || 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${document.originalName}"`);
    res.send(file);
  }

  async listSupplierDocuments(ctx: Ctx & { partnerId?: string; actorType?: string }) {
    const supplierId = this.requireSupplierCtx(ctx);
    await this.getSupplierProfile(ctx);
    return this.prisma.supplierDocument.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        supplierId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async uploadSupplierDocument(
    ctx: Ctx & { partnerId?: string; actorType?: string },
    dto: UploadSupplierDocumentDto,
    file?: UploadedBinary,
  ) {
    const supplierId = this.requireSupplierCtx(ctx);
    await this.getSupplierProfile(ctx);
    const stored = await this.storeSupplierDocumentFile(supplierId, file);

    const document = await this.prisma.supplierDocument.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        supplierId,
        fieldKey: dto.fieldKey.trim(),
        label: dto.label?.trim() || null,
        originalName: stored.originalName,
        mimeType: stored.mimeType ?? null,
        sizeBytes: stored.sizeBytes ?? null,
        storagePath: stored.storagePath,
      },
    });

    await this.prisma.supplierOnboardingProfile.update({
      where: { supplierId },
      data: {
        verificationStatus: 'UNDER_REVIEW',
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? `supplier:${supplierId}`,
      eventType: 'SUPPLIER_VERIFICATION_DOCUMENT_UPLOADED',
      entityType: 'Supplier',
      entityId: supplierId,
      payload: {
        documentId: document.id,
        fieldKey: document.fieldKey,
        originalName: document.originalName,
      },
    });

    return document;
  }

  async downloadSupplierDocument(
    ctx: Ctx & { partnerId?: string; actorType?: string },
    documentId: string,
    res: Response,
  ) {
    const supplierId = this.requireSupplierCtx(ctx);
    const document = await this.prisma.supplierDocument.findFirst({
      where: {
        id: documentId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        supplierId,
      },
    });

    if (!document) {
      throw new NotFoundException('Supplier document not found');
    }

    const file = await readFile(document.storagePath);
    res.setHeader('content-type', document.mimeType || 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${document.originalName}"`);
    res.send(file);
  }
}
