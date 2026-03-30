import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient, ServiceFamily, ValidationEntityType } from '@prisma/client';

const prisma = new PrismaClient();

type TaxonomyRow = {
  id: string;
  name: string;
  level1: string;
  level2: string;
  level3: string;
  archetype: string;
};

type RuleFormOverlayRow = {
  countryCode: string;
  prFormKey?: string;
  rfqFormKey?: string;
  bidFormKey?: string;
  prRulePackKey?: string;
  rfqRulePackKey?: string;
  bidRulePackKey?: string;
  metadata?: unknown;
};

type RuleFormRow = {
  subcategoryId: string;
  serviceFamily: ServiceFamily;
  prFormKey: string;
  rfqFormKey: string;
  bidFormKey: string;
  prRulePackKey: string;
  rfqRulePackKey: string;
  bidRulePackKey: string;
  metadata?: unknown;
  overlays?: RuleFormOverlayRow[];
};

type RequiredFieldRow = {
  rulePackKey: string;
  entityType: ValidationEntityType;
  fieldPath: string;
  required?: boolean;
  message?: string;
  condition?: unknown;
};

function loadJson<T>(filename: string): T {
  const file = path.join(__dirname, 'data', filename);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

async function main() {
  const canonicalSubcategories = loadJson<TaxonomyRow[]>('appendix-a-taxonomy.json');
  const legacySubcategories = loadJson<TaxonomyRow[]>('appendix-a-taxonomy-legacy.json');
  const canonicalRuleFormMap = loadJson<RuleFormRow[]>('appendix-c-rule-form-map.json');
  const legacyRuleFormMap = loadJson<RuleFormRow[]>('appendix-c-rule-form-map-legacy.json');
  const canonicalRequiredFields = loadJson<RequiredFieldRow[]>('appendix-c-required-fields.json');
  const legacyRequiredFields = loadJson<RequiredFieldRow[]>('appendix-c-required-fields-legacy.json');

  const subcategoriesById = new Map<string, TaxonomyRow>();
  for (const s of canonicalSubcategories) subcategoriesById.set(s.id, s);
  for (const s of legacySubcategories) subcategoriesById.set(s.id, s);
  const subcategories = [...subcategoriesById.values()];

  const ruleFormBySubcategory = new Map<string, RuleFormRow>();
  for (const row of canonicalRuleFormMap) ruleFormBySubcategory.set(row.subcategoryId, row);
  for (const row of legacyRuleFormMap) ruleFormBySubcategory.set(row.subcategoryId, row);
  const ruleFormMap = [...ruleFormBySubcategory.values()];

  for (const s of subcategories) {
    await prisma.subcategory.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        level1: s.level1,
        level2: s.level2,
        level3: s.level3,
        archetype: s.archetype,
      },
      create: s,
    });
  }

  for (const row of ruleFormMap) {
    await prisma.subcategoryRuleFormConfig.upsert({
      where: { subcategoryId: row.subcategoryId },
      update: {
        prFormKey: row.prFormKey,
        rfqFormKey: row.rfqFormKey,
        bidFormKey: row.bidFormKey,
        prRulePackKey: row.prRulePackKey,
        rfqRulePackKey: row.rfqRulePackKey,
        bidRulePackKey: row.bidRulePackKey,
        serviceFamily: row.serviceFamily,
        metadata: toJson(row.metadata),
      },
      create: {
        subcategoryId: row.subcategoryId,
        prFormKey: row.prFormKey,
        rfqFormKey: row.rfqFormKey,
        bidFormKey: row.bidFormKey,
        prRulePackKey: row.prRulePackKey,
        rfqRulePackKey: row.rfqRulePackKey,
        bidRulePackKey: row.bidRulePackKey,
        serviceFamily: row.serviceFamily,
        metadata: toJson(row.metadata),
      },
    });

    const overlays = row.overlays ?? [];
    for (const overlay of overlays) {
      await prisma.subcategoryRuleFormOverlay.upsert({
        where: {
          subcategoryId_countryCode: {
            subcategoryId: row.subcategoryId,
            countryCode: overlay.countryCode.toUpperCase(),
          },
        },
        update: {
          prFormKey: overlay.prFormKey,
          rfqFormKey: overlay.rfqFormKey,
          bidFormKey: overlay.bidFormKey,
          prRulePackKey: overlay.prRulePackKey,
          rfqRulePackKey: overlay.rfqRulePackKey,
          bidRulePackKey: overlay.bidRulePackKey,
          metadata: toJson(overlay.metadata),
        },
        create: {
          subcategoryId: row.subcategoryId,
          countryCode: overlay.countryCode.toUpperCase(),
          prFormKey: overlay.prFormKey,
          rfqFormKey: overlay.rfqFormKey,
          bidFormKey: overlay.bidFormKey,
          prRulePackKey: overlay.prRulePackKey,
          rfqRulePackKey: overlay.rfqRulePackKey,
          bidRulePackKey: overlay.bidRulePackKey,
          metadata: toJson(overlay.metadata),
        },
      });
    }
  }

  const requiredFieldByKey = new Map<string, RequiredFieldRow>();
  for (const req of canonicalRequiredFields) {
    requiredFieldByKey.set(`${req.rulePackKey}::${req.entityType}::${req.fieldPath}`, req);
  }
  for (const req of legacyRequiredFields) {
    requiredFieldByKey.set(`${req.rulePackKey}::${req.entityType}::${req.fieldPath}`, req);
  }
  const requiredFields = [...requiredFieldByKey.values()];

  for (const req of requiredFields) {
    await prisma.rulePackFieldRequirement.upsert({
      where: {
        rulePackKey_entityType_fieldPath: {
          rulePackKey: req.rulePackKey,
          entityType: req.entityType,
          fieldPath: req.fieldPath,
        },
      },
      update: {
        required: req.required ?? true,
        message: req.message,
        condition: toJson(req.condition),
      },
      create: {
        rulePackKey: req.rulePackKey,
        entityType: req.entityType,
        fieldPath: req.fieldPath,
        required: req.required ?? true,
        message: req.message,
        condition: toJson(req.condition),
      },
    });
  }

  const [subcatCount, mapCount, overlayCount, requirementCount] = await Promise.all([
    prisma.subcategory.count(),
    prisma.subcategoryRuleFormConfig.count(),
    prisma.subcategoryRuleFormOverlay.count(),
    prisma.rulePackFieldRequirement.count(),
  ]);

  console.log(
    `Seeded taxonomy rows: ${subcategories.length} (canonical=${canonicalSubcategories.length}, legacy=${legacySubcategories.length}, db total: ${subcatCount})`,
  );
  console.log(
    `Seeded rule/form mappings: ${ruleFormMap.length} (canonical=${canonicalRuleFormMap.length}, legacy=${legacyRuleFormMap.length}, db total: ${mapCount})`,
  );
  console.log(`Seeded overlay mappings: ${overlayCount}`);
  console.log(
    `Seeded dynamic required-field rules: ${requiredFields.length} (canonical=${canonicalRequiredFields.length}, legacy=${legacyRequiredFields.length}, db total: ${requirementCount})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
