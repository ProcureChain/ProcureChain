import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceFamily, ValidationEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import fs from 'fs';
import path from 'path';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly coreFieldAliasMap = {
    neededBy: ['metadata.required_date', 'metadata.needed_by', 'metadata.neededby'],
  } as const;

  // Legacy facilities aliases mapped to canonical Appendix C subcategories.
  // This preserves existing IDs while exposing canonical form/rule coverage.
  private readonly appendixCAliases: Record<string, string> = {
    'FAC-SRV-MNT-001': 'SER_MAI_MECHANICAL_M',
    'FAC-SRV-CLN-001': 'SER_MEA_CLEANING_M²',
  };

  normalizeAppendixCSubcategoryId(subcategoryId: string) {
    return this.appendixCAliases[subcategoryId] ?? subcategoryId;
  }

  private readonly lineBindingsByFormKey: Record<
    string,
    { description?: string[]; quantity?: string[]; uom?: string[] }
  > = {
    // Legacy facilities aliases resolved to canonical service templates.
    'pr.fac.srv.maintenance.v1': {
      description: ['metadata.service_desc'],
      quantity: ['metadata.quantity_measure'],
      uom: ['metadata.unit'],
    },
    'pr.fac.srv.cleaning.v1': {
      description: ['metadata.service_desc'],
      quantity: ['metadata.quantity_measure'],
      uom: ['metadata.unit'],
    },
  };

  private lineBindingsByServiceFamily(family: ServiceFamily) {
    // Service families are mostly service-style in Appendix C: service_desc + quantity_measure + unit_rate + unit.
    // Goods/material-like forms use item_name + qty + uom.
    if (family === 'MEASURABLE' || family === 'LABOUR' || family === 'PROFESSIONAL' || family === 'MAINTENANCE') {
      return {
        description: ['metadata.service_desc', 'metadata.item_name'],
        quantity: ['metadata.quantity_measure', 'metadata.qty'],
        uom: ['metadata.unit', 'metadata.uom'],
      };
    }
    return {
      description: ['metadata.item_name', 'metadata.service_desc'],
      quantity: ['metadata.qty', 'metadata.quantity_measure'],
      uom: ['metadata.uom', 'metadata.unit'],
    };
  }

  private resolveLineBindings(prFormKey: string, family: ServiceFamily) {
    const byFormKey = this.lineBindingsByFormKey[prFormKey.toLowerCase()];
    if (byFormKey) {
      return byFormKey;
    }
    if (prFormKey.startsWith('PR_GOO_')) {
      return {
        description: ['metadata.item_name'],
        quantity: ['metadata.qty'],
        uom: ['metadata.uom'],
      };
    }
    if (prFormKey.startsWith('PR_SER_')) {
      return {
        description: ['metadata.service_desc'],
        quantity: ['metadata.quantity_measure'],
        uom: ['metadata.unit'],
      };
    }
    return this.lineBindingsByServiceFamily(family);
  }

  private readonly unitFieldAllowedSubcategoryIds = new Set([
    'SER_MEA_CLEANING_M²',
    'SER_MEA_EQUIPMENT_HI',
    'SER_MEA_LAUNDRY_KG',
    'SER_MEA_PAINTING_M²',
    'SER_MEA_SECURITY_GUA',
    'SER_MEA_TRANSPORT_P',
    'SER_MEA_WASTE_REMOVA',
  ]);

  private readonly estimatedQuantityLegacySubcategoryIds = new Set([
    'FAC-SRV-CLN-001',
    'FAC-SRV-MNT-001',
  ]);

  private readonly projectTimelineDocumentSubcategoryIds = new Set([
    'WOR_CON_BUILDING_CON',
    'WOR_CON_CIVIL_WORKS',
    'WOR_CON_CONCRETE_WOR',
    'WOR_CON_FENCING',
    'WOR_CON_RENOVATIONS',
    'WOR_CON_ROAD_WORKS',
    'WOR_CON_STEEL_ERECTI',
    'WOR_FIT_MEZZANINE_FL',
    'WOR_FIT_OFFICE_FIT_O',
    'WOR_FIT_RACKING_INST',
    'WOR_FIT_WORKSHOP_FIT',
    'WOR_IND_AUTOMATION_I',
    'WOR_IND_ELECTRICAL_I',
    'WOR_IND_EQUIPMENT_CO',
    'WOR_IND_PLANT_INSTAL',
    'WOR_IND_PROCESS_PIPI',
    'WOR_IND_SHUTDOWN_PRO',
    'WOR_IND_TURNKEY_PROJ',
    'WOR_INF_CONCRETE_FOU',
    'WOR_INF_DRAINAGE',
    'WOR_INF_ELECTRICAL_S',
    'WOR_INF_SOLAR_INSTAL',
    'WOR_INF_WATER_RETICU',
  ]);

  private shouldKeepDynamicField(
    requestedSubcategoryId: string,
    subcategory: { id: string },
    fieldPath: string,
  ) {
    if (fieldPath === 'metadata.unit_rate') {
      return false;
    }
    if (
      this.estimatedQuantityLegacySubcategoryIds.has(requestedSubcategoryId)
      && fieldPath === 'metadata.unit_rate'
    ) {
      return false;
    }
    if (
      this.projectTimelineDocumentSubcategoryIds.has(requestedSubcategoryId)
      && ['metadata.boq_sow', 'metadata.retention_optional'].includes(fieldPath)
    ) {
      return false;
    }
    if (fieldPath !== 'metadata.unit') {
      return true;
    }
    if (requestedSubcategoryId !== subcategory.id) {
      return false;
    }
    return this.unitFieldAllowedSubcategoryIds.has(subcategory.id);
  }

  private pruneLineBindings(
    lineBindings: { description?: string[]; quantity?: string[]; uom?: string[] },
    fieldPaths: string[],
  ) {
    const available = new Set(fieldPaths);
    const prune = (paths?: string[]) => paths?.filter((fieldPath) => available.has(fieldPath));
    return {
      description: prune(lineBindings.description),
      quantity: prune(lineBindings.quantity),
      uom: prune(lineBindings.uom),
    };
  }

  private resolveDescriptionFieldBindings(
    metadataFields: Array<{ path: string; key: string; inputType?: string }>,
  ) {
    const exactPriority = [
      'service_desc',
      'service_description',
      'item_name',
      'item_description',
      'description',
      'deliverable_summary',
      'deliverables_summary',
      'scope_of_work',
      'scope_description',
      'work_description',
      'service_name',
      'item_desc',
    ];

    const ranked = metadataFields
      .filter((field) => ['text', 'textarea'].includes(field.inputType ?? 'text'))
      .map((field) => {
        const normalized = field.key.toLowerCase();
        let score = 1000 + exactPriority.length;

        const exactIndex = exactPriority.indexOf(normalized);
        if (exactIndex >= 0) {
          score = exactIndex;
        } else if (/(service|item|deliverable|scope|work).*(desc|description|name|summary)/.test(normalized)) {
          score = 100;
        } else if (/(desc|description|summary|scope)/.test(normalized)) {
          score = 200;
        } else if (/name/.test(normalized)) {
          score = 300;
        }

        return { path: field.path, score, normalized };
      })
      .filter((field) => field.score < 1000 + exactPriority.length)
      .sort((a, b) => a.score - b.score || a.normalized.localeCompare(b.normalized));

    return [...new Set(ranked.map((field) => field.path))];
  }

  private mergeLineBindings(
    base: { description?: string[]; quantity?: string[]; uom?: string[] },
    metadataFields: Array<{ path: string; key: string; inputType?: string }>,
  ) {
    const descriptionCandidates = this.resolveDescriptionFieldBindings(metadataFields);
    return {
      description: [...new Set([...(descriptionCandidates ?? []), ...(base.description ?? [])])],
      quantity: base.quantity ?? [],
      uom: base.uom ?? [],
    };
  }

  private resolveUomPolicy(
    subcategory: { id: string; name: string; level1: string; level2: string; level3: string },
    metadataFields: Array<{ path: string; key: string }>,
  ) {
    const metadataUnitField =
      metadataFields.find((field) => field.path === 'metadata.unit') ??
      metadataFields.find((field) => field.path === 'metadata.uom');

    if (!metadataUnitField) {
      return null;
    }

    const explicitOptions = this.resolveUomOptionsForSubcategory(subcategory);

    if (explicitOptions.length > 0) {
      return {
        fieldPath: metadataUnitField.path,
        options: explicitOptions,
        locked: explicitOptions.length <= 1,
        defaultValue: explicitOptions[0],
      };
    }

    return {
      fieldPath: metadataUnitField.path,
      options: [],
      locked: false,
      defaultValue: undefined,
    };
  }

  private resolveUomOptionsForSubcategory(subcategory: {
    id: string;
    name: string;
    level1: string;
    level2: string;
    level3: string;
  }) {
    const explicit = this.inferUomOptionsFromCanonicalSubcategory(
      subcategory.id,
      `${subcategory.level1} ${subcategory.level2} ${subcategory.level3} ${subcategory.name}`.toLowerCase(),
    );
    if (explicit.length > 0) {
      return explicit;
    }
    return this.inferUomOptionsFromTaxonomyFamily(subcategory);
  }

  private inferUomOptionsFromCanonicalSubcategory(subcategoryId: string, normalizedTitle: string) {
    const explicitById: Record<string, string[]> = {
      'FAC-SRV-MNT-001': ['Daily', 'Weekly', 'Monthly'],
      'FAC-SRV-CLN-001': ['m2'],
      'IT-SW-LIC-001': ['Monthly', 'Yearly'],
      'IT-SW-SUB-001': ['Monthly', 'Yearly'],
      SER_MAI_MECHANICAL_M: ['Daily', 'Weekly', 'Monthly'],
      'SER_MEA_CLEANING_M²': ['Square metre (m2)', 'Square foot (ft2)'],
      'SER_MEA_PAINTING_M²': ['Square metre (m2)', 'Square foot (ft2)'],
      'SER_MEA_TRANSPORT_P': ['Kilometre (km)', 'Mile (mi)'],
      'SER_MEA_WASTE_REMOVA': ['Kilogram (kg)', 'Tonne (t)', 'Pound (lb)'],
      'SER_MEA_LAUNDRY_KG': ['Kilogram (kg)', 'Pound (lb)'],
      'SER_MEA_SECURITY_GUA': ['Hour', 'Day', 'Shift'],
      'SER_MEA_EQUIPMENT_HI': ['Day', 'Week', 'Month'],
    };

    const direct = explicitById[subcategoryId];
    if (direct) {
      return direct;
    }

    const title = normalizedTitle
      .normalize('NFKD')
      .replace(/m²/g, 'm2')
      .replace(/[^\w\s/()-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const options: string[] = [];
    const add = (value: string) => {
      if (!options.includes(value)) options.push(value);
    };

    if (/\bm2\b|\bm 2\b|square metre|square meter/.test(title)) add('m2');
    if (/\bhourly\b|\bhours?\b/.test(title)) add('Hourly');
    if (/\bdaily\b|\bdays?\b/.test(title)) add('Daily');
    if (/\bweekly\b|\bweeks?\b/.test(title)) add('Weekly');
    if (/\bmonthly\b|\bmonths?\b/.test(title)) add('Monthly');
    if (/\bper km\b|\bkm\b|\bkilomet/.test(title)) add('km');
    if (/\btrip\b/.test(title)) add('Trip');
    if (/\btons?\b|\btonnes?\b|\bkg\b|\bkilograms?\b|\bvolume\/weight\b/.test(title)) {
      add('kg');
      add('Ton');
    }
    if (/\bper head\b|\bheadcount\b/.test(title)) add('Per Head');
    if (/\bsite based\b/.test(title)) add('Per Site');

    return options;
  }

  private inferUomOptionsFromTaxonomyFamily(subcategory: {
    id: string;
    name: string;
    level1: string;
    level2: string;
    level3: string;
  }) {
    const level1 = subcategory.level1.toLowerCase();
    const level2 = subcategory.level2.toLowerCase();
    const title = `${subcategory.level3} ${subcategory.name}`.toLowerCase();

    if (level1 === 'goods & materials') {
      if (level2.includes('chemicals')) {
        return ['Millilitre (ml)', 'Litre (L)', 'Kilolitre (kL)', 'Gallon (gal)', 'Kilogram (kg)', 'Pound (lb)', 'Tonne (t)'];
      }
      if (level2.includes('raw materials')) {
        if (/(timber|plywood|lumber|plank|board)/.test(title)) {
          return ['Metre (m)', 'Foot (ft)', 'Each (EA)'];
        }
        if (/(sheet|plate|floor|flooring|tile|tiles)/.test(title)) {
          return ['Square metre (m2)', 'Square foot (ft2)', 'Each (EA)'];
        }
        if (/(steel|aluminium|copper|brass|bronze|cast iron|composites|ceramics)/.test(title)) {
          return ['Kilogram (kg)', 'Tonne (t)', 'Pound (lb)', 'Metre (m)', 'Foot (ft)'];
        }
        return ['Each (EA)', 'Kilogram (kg)', 'Tonne (t)', 'Pound (lb)', 'Metre (m)', 'Foot (ft)'];
      }
      if (level2.includes('instrumentation')) {
        return ['Each (EA)', 'Set'];
      }
      if (level2.includes('packaging')) {
        return ['Each (EA)', 'Box', 'Pack', 'Roll', 'Pallet'];
      }
      if (level2.includes('electrical')) {
        return ['Each (EA)', 'Set', 'Metre (m)', 'Foot (ft)', 'Roll'];
      }
      if (level2.includes('mechanical')) {
        return ['Each (EA)', 'Set', 'Metre (m)', 'Foot (ft)', 'Kilogram (kg)', 'Pound (lb)'];
      }
      if (level2.includes('ppe')) {
        return ['Each (EA)', 'Pair', 'Set', 'Box', 'Pack'];
      }
      if (level2.includes('quality')) {
        return ['Each (EA)', 'Set', 'Box', 'Pack'];
      }
    }

    if (level1 === 'mro') {
      if (level2.includes('spare parts')) {
        return ['Each (EA)', 'Set', 'Pair'];
      }
      if (level2.includes('utilities')) {
        return ['Each (EA)', 'Set', 'Litre (L)', 'Gallon (gal)'];
      }
      if (level2.includes('facilities')) {
        if (/(paint|coating)/.test(title)) {
          return ['Millilitre (ml)', 'Litre (L)', 'Gallon (gal)'];
        }
        if (/(floor|flooring|tile)/.test(title)) {
          return ['Square metre (m2)', 'Square foot (ft2)', 'Each (EA)'];
        }
        if (/(plumbing|pipe|pipes)/.test(title)) {
          return ['Metre (m)', 'Foot (ft)', 'Each (EA)'];
        }
        if (/(water treatment|chemical)/.test(title)) {
          return ['Millilitre (ml)', 'Litre (L)', 'Gallon (gal)', 'Kilogram (kg)', 'Pound (lb)'];
        }
        if (/(waste handling)/.test(title)) {
          return ['Each (EA)', 'Set'];
        }
        return ['Each (EA)', 'Box', 'Roll', 'Metre (m)', 'Foot (ft)', 'Square metre (m2)', 'Square foot (ft2)', 'Litre (L)', 'Gallon (gal)'];
      }
      if (level2.includes('tools')) {
        return ['Each (EA)', 'Set'];
      }
      if (level2.includes('lubrication')) {
        return ['Millilitre (ml)', 'Litre (L)', 'Kilolitre (kL)', 'Gallon (gal)'];
      }
      if (level2.includes('safety systems')) {
        return ['Each (EA)', 'Set', 'Metre (m)', 'Foot (ft)'];
      }
    }

    return [];
  }

  private inferFieldType(fieldKey: string) {
    if (/(^|_)(doc|document|documents|attachment|attachments|file|files|upload|certificate|certificates|license|licence|permit|drawing|drawings)(_|$)/i.test(fieldKey)) {
      return 'file';
    }
    if (fieldKey.endsWith('_json')) return 'textarea';
    if (fieldKey.endsWith('_date')) return 'date';
    if (/^(is_|has_|requires_|require_)/.test(fieldKey)) return 'checkbox';
    if (/(^|_)(qty|quantity|amount|value|price|rate|days|hours|months|years)(_|$)/.test(fieldKey)) {
      return 'number';
    }
    return 'text';
  }

  private humanizeFieldKey(fieldKey: string) {
    return fieldKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  private resolveDynamicFieldLabel(requestedSubcategoryId: string, fieldKey: string) {
    if (fieldKey === 'spec_json') {
      return 'Specifications';
    }
    if (fieldKey === 'uom' || fieldKey === 'unit') {
      return 'UOM';
    }
    if (
      this.estimatedQuantityLegacySubcategoryIds.has(requestedSubcategoryId)
      && fieldKey === 'quantity_measure'
    ) {
      return 'Quantity Estimated';
    }
    return this.humanizeFieldKey(fieldKey);
  }

  private resolveDynamicFieldOverrides(requestedSubcategoryId: string) {
    const consultingServiceIds = new Set([
      'PRO-SRV-CON-001',
      'SER_PRO_ACCOUNTING_AND',
      'SER_PRO_ENGINEERING_',
      'SER_PRO_ENVIRONMENTA',
      'SER_PRO_HR_CONSULTIN',
      'SER_PRO_IT_CONSULTIN',
      'SER_PRO_LEGAL_SERVIC',
      'SER_PRO_PROJECT_MANA',
      'SER_PRO_QUALITY_CONS',
      'SER_PRO_SAFETY_CONSU',
      'SER_PRO_TRAINING_SER',
    ]);

    if (
      [
        'SER_LAB_ARTISANS',
        'SER_LAB_ELECTRICIANS',
        'SER_LAB_FITTERS_AND_TU',
        'SER_LAB_GENERAL_LABO',
        'SER_LAB_OPERATORS_M',
        'SER_LAB_RIGGERS',
        'SER_LAB_SKILLED_TECH',
        'SER_LAB_SUPERVISORS_',
        'SER_LAB_WELDERS',
      ].includes(requestedSubcategoryId)
    ) {
      return {
        fields: [
          {
            path: 'metadata.service_desc',
            key: 'service_desc',
            label: 'Service Description',
            inputType: 'textarea',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.unit_qty',
            key: 'unit_qty',
            label: 'Unit Qty',
            inputType: 'number',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.unit_is_days',
            key: 'unit_is_days',
            label: 'Classify Unit As Days',
            inputType: 'checkbox',
            required: false,
            section: 'subcategory',
            message: 'Unchecked means hours.',
          },
          {
            path: 'metadata.seniority',
            key: 'seniority',
            label: 'Seniority',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.end_date',
            key: 'end_date',
            label: 'End Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
        ],
        lineBindings: {
          description: ['metadata.service_desc'],
          quantity: ['metadata.unit_qty'],
        },
      };
    }

    if (consultingServiceIds.has(requestedSubcategoryId)) {
      if (requestedSubcategoryId === 'PRO-SRV-CON-001') {
        return {
          fields: [
            {
              path: 'metadata.problem_statement',
              key: 'problem_statement',
              label: 'Problem Statement',
              inputType: 'textarea',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.industry',
              key: 'industry',
              label: 'Industry',
              inputType: 'text',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.company_size_num_persons',
              key: 'company_size_num_persons',
              label: 'Company Size (Num Of Persons)',
              inputType: 'number',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.location',
              key: 'location',
              label: 'Location',
              inputType: 'text',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.current_systems_in_use',
              key: 'current_systems_in_use',
              label: 'Current Systems In Use',
              inputType: 'textarea',
              required: false,
              section: 'subcategory',
            },
            {
              path: 'metadata.scope_of_work',
              key: 'scope_of_work',
              label: 'Scope Of Work',
              inputType: 'textarea',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.deliverables_reports',
              key: 'deliverables_reports',
              label: 'Deliverables: Reports',
              inputType: 'checkbox',
              required: false,
              section: 'subcategory',
            },
            {
              path: 'metadata.deliverables_dashboards',
              key: 'deliverables_dashboards',
              label: 'Deliverables: Dashboards',
              inputType: 'checkbox',
              required: false,
              section: 'subcategory',
            },
            {
              path: 'metadata.deliverables_workshops',
              key: 'deliverables_workshops',
              label: 'Deliverables: Workshops',
              inputType: 'checkbox',
              required: false,
              section: 'subcategory',
            },
            {
              path: 'metadata.deliverables_other',
              key: 'deliverables_other',
              label: 'Deliverables: Other',
              inputType: 'checkbox',
              required: false,
              section: 'subcategory',
            },
            {
              path: 'metadata.start_date',
              key: 'start_date',
              label: 'Start Date',
              inputType: 'date',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.end_date',
              key: 'end_date',
              label: 'End Date',
              inputType: 'date',
              required: true,
              section: 'subcategory',
            },
            {
              path: 'metadata.seniority',
              key: 'seniority',
              label: 'Seniority',
              inputType: 'select',
              required: true,
              section: 'subcategory',
              options: ['Expert', 'Senior', 'Mid', 'Junior'],
            },
            {
              path: 'metadata.supporting_documents',
              key: 'supporting_documents',
              label: 'Supporting Documents',
              inputType: 'file',
              required: false,
              section: 'subcategory',
            },
            ...this.resolveAdditionalDynamicFields(requestedSubcategoryId),
          ],
          lineBindings: {
            description: ['metadata.scope_of_work'],
          },
        };
      }
    }

    if (requestedSubcategoryId === 'PRO-SRV-CON-001') {
      return {
        fields: [
          {
            path: 'metadata.problem_statement',
            key: 'problem_statement',
            label: 'Problem Statement',
            inputType: 'textarea',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.industry',
            key: 'industry',
            label: 'Industry',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.company_size_num_persons',
            key: 'company_size_num_persons',
            label: 'Company Size (Num Of Persons)',
            inputType: 'number',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.location',
            key: 'location',
            label: 'Location',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.current_systems_in_use',
            key: 'current_systems_in_use',
            label: 'Current Systems In Use',
            inputType: 'textarea',
            required: false,
            section: 'subcategory',
          },
          {
            path: 'metadata.scope_of_work',
            key: 'scope_of_work',
            label: 'Scope Of Work',
            inputType: 'textarea',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.deliverables_reports',
            key: 'deliverables_reports',
            label: 'Deliverables: Reports',
            inputType: 'checkbox',
            required: false,
            section: 'subcategory',
          },
          {
            path: 'metadata.deliverables_dashboards',
            key: 'deliverables_dashboards',
            label: 'Deliverables: Dashboards',
            inputType: 'checkbox',
            required: false,
            section: 'subcategory',
          },
          {
            path: 'metadata.deliverables_workshops',
            key: 'deliverables_workshops',
            label: 'Deliverables: Workshops',
            inputType: 'checkbox',
            required: false,
            section: 'subcategory',
          },
          {
            path: 'metadata.deliverables_other',
            key: 'deliverables_other',
            label: 'Deliverables: Other',
            inputType: 'checkbox',
            required: false,
            section: 'subcategory',
          },
          {
            path: 'metadata.start_date',
            key: 'start_date',
            label: 'Start Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.end_date',
            key: 'end_date',
            label: 'End Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.seniority',
            key: 'seniority',
            label: 'Seniority',
            inputType: 'select',
            required: true,
            section: 'subcategory',
            options: ['Expert', 'Senior', 'Mid', 'Junior'],
          },
          {
            path: 'metadata.supporting_documents',
            key: 'supporting_documents',
            label: 'Supporting Documents',
            inputType: 'file',
            required: false,
            section: 'subcategory',
          },
        ],
        lineBindings: {
          description: ['metadata.scope_of_work'],
        },
      };
    }

    if (requestedSubcategoryId === 'LOG_FRE_WAREHOUSING') {
      return {
        fields: [
          {
            path: 'metadata.storage_type',
            key: 'storage_type',
            label: 'Storage Type',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.storage_duration',
            key: 'storage_duration',
            label: 'Storage Duration',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.quantity_estimated',
            key: 'quantity_estimated',
            label: 'Quantity Estimated',
            inputType: 'number',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.location',
            key: 'location',
            label: 'Location',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.hazardous',
            key: 'hazardous',
            label: 'Hazardous',
            inputType: 'checkbox',
            required: false,
            section: 'subcategory',
          },
        ],
      };
    }

    if (requestedSubcategoryId === 'LOG_FRE_CUSTOMS_CLEA') {
      return {
        fields: [
          {
            path: 'metadata.mode_of_transport',
            key: 'mode_of_transport',
            label: 'Mode Of Transport',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.import_or_export',
            key: 'import_or_export',
            label: 'Import Or Export',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.country_of_origin',
            key: 'country_of_origin',
            label: 'Country Of Origin',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.commodity_code',
            key: 'commodity_code',
            label: 'Commodity Code',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.quantity_of_item_cleared',
            key: 'quantity_of_item_cleared',
            label: 'Quantity Of Item Being Cleared',
            inputType: 'number',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.value_currency',
            key: 'value_currency',
            label: 'Value (Currency)',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.pickup_date',
            key: 'pickup_date',
            label: 'Pickup Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.delivery_date',
            key: 'delivery_date',
            label: 'Delivery Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.incoterms',
            key: 'incoterms',
            label: 'Incoterms',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.supporting_document',
            key: 'supporting_document',
            label: 'Document Upload',
            inputType: 'file',
            required: false,
            section: 'subcategory',
          },
        ],
        lineBindings: {
          quantity: ['metadata.quantity_of_item_cleared'],
        },
      };
    }

    if (
      [
        'LOG_COU_DOCUMENT_COU',
        'LOG_COU_ECONOMY_COUR',
        'LOG_COU_INTERNATIONA',
        'LOG_COU_OVERNIGHT_CO',
        'LOG_COU_SAME_DAY_COU',
        'LOG_FRE_AIR_FREIGHT',
        'LOG_FRE_COLD_CHAIN_L',
        'LOG_FRE_CROSS_BORDER',
        'LOG_FRE_ROAD_FREIGHT',
        'LOG_FRE_SEA_FREIGHT_',
        'LOG_SPE_ABNORMAL_LOA',
        'LOG_SPE_CRANE_HIRE_L',
        'LOG_SPE_HAZARDOUS_GO',
        'LOG_SPE_HEAVY_MACHIN',
      ].includes(requestedSubcategoryId)
    ) {
      return {
        fields: [
          {
            path: 'metadata.pickup_location',
            key: 'pickup_location',
            label: 'Pickup Location',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.delivery_location',
            key: 'delivery_location',
            label: 'Delivery Location',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.package_details',
            key: 'package_details',
            label: 'Package Details',
            inputType: 'textarea',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.pickup_date',
            key: 'pickup_date',
            label: 'Pickup Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.delivery_date',
            key: 'delivery_date',
            label: 'Delivery Date',
            inputType: 'date',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.incoterms',
            key: 'incoterms',
            label: 'Incoterms',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
        ],
        lineBindings: {
          description: ['metadata.package_details'],
        },
      };
    }

    if (['IT-SW-LIC-001', 'IT-SW-SUB-001'].includes(requestedSubcategoryId)) {
      return {
        fields: [
          {
            path: 'metadata.item_name',
            key: 'item_name',
            label: 'Name',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.no_of_users',
            key: 'no_of_users',
            label: 'No Of Users',
            inputType: 'number',
            required: true,
            section: 'subcategory',
          },
          {
            path: 'metadata.uom',
            key: 'uom',
            label: 'Quantity',
            inputType: 'text',
            required: true,
            section: 'subcategory',
          },
        ],
        lineBindings: {
          description: ['metadata.item_name'],
          quantity: ['metadata.no_of_users'],
          uom: ['metadata.uom'],
        },
      };
    }

    if (!['IT-HW-END-001', 'IT-HW-PER-001'].includes(requestedSubcategoryId)) {
      return null;
    }

    return {
      fields: [
        {
          path: 'metadata.delivery_location',
          key: 'delivery_location',
          label: 'Delivery Location',
          inputType: 'text',
          required: true,
          section: 'subcategory',
        },
        {
          path: 'metadata.item_name',
          key: 'item_name',
          label: 'Item Name',
          inputType: 'text',
          required: true,
          section: 'subcategory',
        },
        {
          path: 'metadata.qty',
          key: 'qty',
          label: 'Qty',
          inputType: 'number',
          required: true,
          section: 'subcategory',
        },
        {
          path: 'metadata.spec_json',
          key: 'spec_json',
          label: 'Specifications',
          inputType: 'textarea',
          required: true,
          section: 'subcategory',
        },
        {
          path: 'metadata.uom',
          key: 'uom',
          label: 'Uom',
          inputType: 'text',
          required: true,
          section: 'subcategory',
        },
      ],
      lineBindings: {
        description: ['metadata.item_name'],
        quantity: ['metadata.qty'],
        uom: ['metadata.uom'],
      },
    };
  }

  private resolveAdditionalDynamicFields(requestedSubcategoryId: string) {
    if (this.projectTimelineDocumentSubcategoryIds.has(requestedSubcategoryId)) {
      return [
        {
          path: 'metadata.timeline',
          key: 'timeline',
          label: 'Timeline',
          inputType: 'select',
          required: true,
          section: 'subcategory',
          options: ['1-3 months', '4-7', '8-12', '12+'],
        },
        {
          path: 'metadata.compliance',
          key: 'compliance',
          label: 'Compliance',
          inputType: 'text',
          required: false,
          section: 'subcategory',
        },
        {
          path: 'metadata.supporting_documents',
          key: 'supporting_documents',
          label: 'Document Upload',
          inputType: 'file',
          required: false,
          section: 'subcategory',
        },
      ];
    }

    if (
      [
        'PRO-SRV-CON-001',
        'SER_PRO_ACCOUNTING_AND',
        'SER_PRO_ENGINEERING_',
        'SER_PRO_ENVIRONMENTA',
        'SER_PRO_HR_CONSULTIN',
        'SER_PRO_IT_CONSULTIN',
        'SER_PRO_LEGAL_SERVIC',
        'SER_PRO_PROJECT_MANA',
        'SER_PRO_QUALITY_CONS',
        'SER_PRO_SAFETY_CONSU',
        'SER_PRO_TRAINING_SER',
      ].includes(requestedSubcategoryId)
    ) {
      return [
        {
          path: 'metadata.milestone_list',
          key: 'milestone_list',
          label: 'Milestone List',
          inputType: 'milestones',
          required: true,
          section: 'subcategory',
          message: 'Add each milestone with text and target date.',
        },
        {
          path: 'metadata.team_profile',
          key: 'team_profile',
          label: 'Team Profile',
          inputType: 'textarea',
          required: false,
          section: 'subcategory',
        },
        {
          path: 'metadata.timeline',
          key: 'timeline',
          label: 'Timeline',
          inputType: 'select',
          required: true,
          section: 'subcategory',
          options: ['1-3 months', '4-7 months', '8-12 months', '+12 months'],
        },
      ];
    }

    return [];
  }

  private resolveDisplayedSubcategory(
    requestedSubcategoryId: string,
    subcategory: { id: string; name: string; archetype: string; level1: string; level2: string; level3: string },
  ) {
    if (requestedSubcategoryId === 'IT-HW-PER-001') {
      return {
        ...subcategory,
        name: 'Accessories',
        level3: 'Accessories',
      };
    }

    return subcategory;
  }

  private resolveCoreFieldBindings(fieldRows: Array<{ fieldPath: string }>) {
    return {
      neededBy: this.coreFieldAliasMap.neededBy.filter((alias) =>
        fieldRows.some((row) => row.fieldPath === alias),
      ),
    };
  }

  private loadCanonicalIds() {
    const candidateDirs = [
      path.join(__dirname, '..', 'prisma', 'data'),
      path.join(process.cwd(), 'src', 'prisma', 'data'),
      path.join(process.cwd(), 'dist', 'prisma', 'data'),
    ];
    const dir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'appendix-a-taxonomy.json')));
    if (!dir) {
      throw new NotFoundException('Canonical taxonomy data files not found');
    }

    const taxonomy = JSON.parse(
      fs.readFileSync(path.join(dir, 'appendix-a-taxonomy.json'), 'utf8'),
    ) as Array<{ id: string }>;
    const map = JSON.parse(
      fs.readFileSync(path.join(dir, 'appendix-c-rule-form-map.json'), 'utf8'),
    ) as Array<{ subcategoryId: string }>;
    const required = JSON.parse(
      fs.readFileSync(path.join(dir, 'appendix-c-required-fields.json'), 'utf8'),
    ) as Array<{ rulePackKey: string; entityType: string; fieldPath: string }>;

    return {
      taxonomyIds: taxonomy.map((x) => x.id),
      mappingIds: map.map((x) => x.subcategoryId),
      requiredFieldKeys: required.map((x) => `${x.rulePackKey}::${x.entityType}::${x.fieldPath}`),
    };
  }

  private locationProviderConfig() {
    const provider = (process.env.GEOCODER_PROVIDER ?? '').trim().toUpperCase();
    const baseUrl = (process.env.GEOCODER_BASE_URL ?? '').trim();
    return {
      provider: provider || (baseUrl ? 'NOMINATIM_COMPAT' : 'NONE'),
      baseUrl,
      apiKey: process.env.GEOCODER_API_KEY?.trim() || '',
      userAgent: process.env.GEOCODER_USER_AGENT?.trim() || 'ProcureChain/1.0',
    };
  }

  private mapNominatimSuggestion(row: Record<string, any>) {
    const address = row.address ?? {};
    return {
      id: String(row.place_id ?? row.osm_id ?? row.display_name ?? crypto.randomUUID()),
      label: String(row.display_name ?? ''),
      lat: Number(row.lat ?? 0),
      lng: Number(row.lon ?? 0),
      address: {
        line1: [address.house_number, address.road].filter(Boolean).join(' ').trim() || undefined,
        city: address.city ?? address.town ?? address.village ?? address.municipality ?? undefined,
        province: address.state ?? address.region ?? address.county ?? undefined,
        postalCode: address.postcode ?? undefined,
        country: address.country ?? undefined,
        countryCode: typeof address.country_code === 'string' ? address.country_code.toUpperCase() : undefined,
      },
    };
  }

  private mapGeoapifySuggestion(row: Record<string, any>) {
    return {
      id: String(row.place_id ?? row.result_type ?? row.formatted ?? crypto.randomUUID()),
      label: String(row.formatted ?? row.address_line1 ?? row.address_line2 ?? ''),
      lat: Number(row.lat ?? 0),
      lng: Number(row.lon ?? 0),
      address: {
        line1: row.address_line1 ?? undefined,
        city: row.city ?? row.town ?? row.village ?? row.county ?? undefined,
        province: row.state ?? row.state_code ?? undefined,
        postalCode: row.postcode ?? undefined,
        country: row.country ?? undefined,
        countryCode: typeof row.country_code === 'string' ? row.country_code.toUpperCase() : undefined,
      },
    };
  }

  async locationSuggest(q: string, country?: string, limit = 5) {
    const query = q.trim();
    const cfg = this.locationProviderConfig();
    if (query.length < 3) {
      return { configured: cfg.provider !== 'NONE', provider: cfg.provider, suggestions: [] };
    }

    if (cfg.provider === 'NONE') {
      return { configured: false, provider: 'NONE', suggestions: [] };
    }

    const sanitizedLimit = Math.max(1, Math.min(limit, 8));
    let url: URL;
    let mapper: (row: Record<string, any>) => any;
    const headers: Record<string, string> = {
      'User-Agent': cfg.userAgent,
      Accept: 'application/json',
    };

    if (cfg.provider === 'GEOAPIFY') {
      if (!cfg.apiKey) {
        return { configured: false, provider: 'GEOAPIFY', suggestions: [] };
      }
      url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
      url.searchParams.set('text', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', String(sanitizedLimit));
      url.searchParams.set('apiKey', cfg.apiKey);
      if (country?.trim()) {
        url.searchParams.set('filter', `countrycode:${country.trim().toLowerCase()}`);
      }
      mapper = (row) => this.mapGeoapifySuggestion(row);
    } else {
      if (!cfg.baseUrl) {
        return { configured: false, provider: cfg.provider, suggestions: [] };
      }
      url = new URL('/search', cfg.baseUrl.endsWith('/') ? cfg.baseUrl : `${cfg.baseUrl}/`);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', String(sanitizedLimit));
      if (country?.trim()) {
        url.searchParams.set('countrycodes', country.trim().toLowerCase());
      }
      mapper = (row) => this.mapNominatimSuggestion(row);
    }

    const response = await fetch(url.toString(), {
      headers,
    });

    if (!response.ok) {
      return { configured: true, provider: cfg.provider, suggestions: [] };
    }

    const raw = (await response.json()) as Array<Record<string, any>> | { results?: Array<Record<string, any>> };
    const rows = Array.isArray(raw) ? raw : raw.results ?? [];
    return {
      configured: true,
      provider: cfg.provider,
      suggestions: rows.map((row) => mapper(row)),
    };
  }

  async subcategories(q?: string, archetype?: string, limit = 100, canonicalOnly = false) {
    const where: any = {};
    if (archetype) where.archetype = archetype;
    if (canonicalOnly) {
      const { mappingIds } = this.loadCanonicalIds();
      where.id = { in: mappingIds };
    }
    if (q) {
      const qFilter = [
        { id: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { level1: { contains: q, mode: 'insensitive' } },
        { level2: { contains: q, mode: 'insensitive' } },
        { level3: { contains: q, mode: 'insensitive' } },
      ];
      if (where.id) {
        where.AND = [{ OR: qFilter }];
      } else {
        where.OR = qFilter;
      }
    }

    return this.prisma.subcategory.findMany({
      where,
      orderBy: { name: 'asc' },
      take: Math.max(1, Math.min(limit, 500)),
    });
  }

  async resolveEffectiveConfig(subcategoryId: string, country?: string) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        ruleFormConfig: true,
        ruleFormOverlays: country
          ? { where: { countryCode: country.toUpperCase() }, take: 1 }
          : false,
      },
    });

    if (!subcategory) throw new NotFoundException('Subcategory not found');
    if (!subcategory.ruleFormConfig) {
      throw new NotFoundException('No rule/form configuration found for subcategory');
    }

    const base = subcategory.ruleFormConfig;
    const overlay = country ? subcategory.ruleFormOverlays[0] ?? null : null;

    return {
      subcategory: {
        id: subcategory.id,
        name: subcategory.name,
        archetype: subcategory.archetype,
        level1: subcategory.level1,
        level2: subcategory.level2,
        level3: subcategory.level3,
      },
      country: country?.toUpperCase() ?? null,
      resolvedFrom: overlay ? 'country_overlay' : 'base',
      keys: {
        prFormKey: overlay?.prFormKey ?? base.prFormKey,
        rfqFormKey: overlay?.rfqFormKey ?? base.rfqFormKey,
        bidFormKey: overlay?.bidFormKey ?? base.bidFormKey,
        prRulePackKey: overlay?.prRulePackKey ?? base.prRulePackKey,
        rfqRulePackKey: overlay?.rfqRulePackKey ?? base.rfqRulePackKey,
        bidRulePackKey: overlay?.bidRulePackKey ?? base.bidRulePackKey,
      },
      metadata: {
        base: base.metadata,
        overlay: overlay?.metadata ?? null,
      },
    };
  }

  async resolvePrFormSchema(subcategoryId: string, country?: string) {
    const resolvedSubcategoryId = this.normalizeAppendixCSubcategoryId(subcategoryId);
    const effective = await this.resolveEffectiveConfig(resolvedSubcategoryId, country);
    const displayedSubcategory = this.resolveDisplayedSubcategory(subcategoryId, effective.subcategory);
    const config = await this.prisma.subcategoryRuleFormConfig.findUnique({
      where: { subcategoryId: resolvedSubcategoryId },
      select: { serviceFamily: true },
    });

    const fieldRows = await this.prisma.rulePackFieldRequirement.findMany({
      where: {
        rulePackKey: effective.keys.prRulePackKey,
        entityType: ValidationEntityType.PR,
      },
      orderBy: { fieldPath: 'asc' },
    });

    const coreFieldBindings = this.resolveCoreFieldBindings(fieldRows);
    const neededByRequired = coreFieldBindings.neededBy.length > 0;

    const coreFields = [
      { path: 'title', key: 'title', label: 'Title', inputType: 'text', required: true, section: 'core' },
      { path: 'department', key: 'department', label: 'Department', inputType: 'text', required: true, section: 'core' },
      { path: 'costCentre', key: 'costCentre', label: 'Cost Centre', inputType: 'text', required: true, section: 'core' },
      { path: 'requester', key: 'requester', label: 'Requester', inputType: 'text', required: true, section: 'core' },
      { path: 'description', key: 'description', label: 'Justification', inputType: 'textarea', required: false, section: 'core' },
      { path: 'neededBy', key: 'neededBy', label: 'Needed By', inputType: 'date', required: neededByRequired, section: 'core' },
    ];

    const metadataFieldOverrides = this.resolveDynamicFieldOverrides(subcategoryId);

    const baseMetadataFields = metadataFieldOverrides?.fields ?? fieldRows.map((r) => {
      const key = r.fieldPath.startsWith('metadata.') ? r.fieldPath.slice('metadata.'.length) : r.fieldPath;
      return {
        path: r.fieldPath,
        key,
        label: this.resolveDynamicFieldLabel(subcategoryId, key),
        inputType: this.inferFieldType(key),
        required: r.required,
        section: 'subcategory',
        message: r.message ?? undefined,
      };
    });

    const metadataFields = [...this.resolveAdditionalDynamicFields(subcategoryId), ...baseMetadataFields]
      .filter((field, index, fields) => fields.findIndex((candidate) => candidate.path === field.path) === index)
      .filter((field) => {
      if (coreFieldBindings.neededBy.includes(field.path as any)) {
        return false;
      }
      return this.shouldKeepDynamicField(subcategoryId, effective.subcategory, field.path);
      });

    const serviceFamily = config?.serviceFamily ?? 'PROJECT';
    const resolvedBaseLineBindings =
      metadataFieldOverrides?.lineBindings ?? this.resolveLineBindings(effective.keys.prFormKey, serviceFamily);
    const lineBindings = this.pruneLineBindings(
      this.mergeLineBindings(resolvedBaseLineBindings, metadataFields),
      metadataFields.map((field) => field.path),
    );
    const uomPolicy = this.resolveUomPolicy(displayedSubcategory, metadataFields);

    return {
      subcategory: displayedSubcategory,
      requestedSubcategoryId: subcategoryId,
      resolvedSubcategoryId,
      country: effective.country,
      resolvedFrom: effective.resolvedFrom,
      keys: effective.keys,
      serviceFamily,
      lineBindings,
      coreFieldBindings,
      uomPolicy,
      schemaVersion: 'pr-form-schema-v2',
      sections: [
        {
          id: 'core',
          title: 'Core PR Fields',
          fields: coreFields,
        },
        {
          id: 'subcategory',
          title: 'Subcategory-Specific Fields',
          fields: metadataFields,
        },
      ],
      validation: {
        entityType: 'PR',
        rulePackKey: effective.keys.prRulePackKey,
        fieldCount: fieldRows.length,
        requiredFieldCount: fieldRows.filter((r) => r.required).length,
      },
    };
  }

  async integrity() {
    const { taxonomyIds, mappingIds, requiredFieldKeys } = this.loadCanonicalIds();
    const canonicalIdSet = new Set(taxonomyIds);
    const canonicalMappingSet = new Set(mappingIds);

    const [
      subcategoryCount,
      configCount,
      overlayCount,
      requiredFieldCount,
      missingConfigRows,
      configs,
      canonicalSubcategoryCount,
      canonicalConfiguredCount,
      dbRequiredRows,
    ] = await Promise.all([
      this.prisma.subcategory.count(),
      this.prisma.subcategoryRuleFormConfig.count(),
      this.prisma.subcategoryRuleFormOverlay.count(),
      this.prisma.rulePackFieldRequirement.count(),
      this.prisma.subcategory.findMany({
        where: { ruleFormConfig: null },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
        take: 50,
      }),
      this.prisma.subcategoryRuleFormConfig.findMany({
        select: { subcategoryId: true, serviceFamily: true },
      }),
      this.prisma.subcategory.count({
        where: { id: { in: taxonomyIds } },
      }),
      this.prisma.subcategoryRuleFormConfig.count({
        where: { subcategoryId: { in: mappingIds } },
      }),
      this.prisma.rulePackFieldRequirement.findMany({
        select: { rulePackKey: true, entityType: true, fieldPath: true, required: true },
      }),
    ]);

    const missingConfigCount = Math.max(0, subcategoryCount - configCount);
    const allFamilies = ['MEASURABLE', 'LABOUR', 'PROFESSIONAL', 'MAINTENANCE', 'PROJECT', 'HYBRID'];
    const familyCoverage = allFamilies.map((family) => ({
      family,
      subcategoryCount: configs.filter((c) => c.serviceFamily === family).length,
    }));
    const completeFamilyCoverage = familyCoverage.every((f) => f.subcategoryCount > 0);

    const requiredKeySet = new Set(requiredFieldKeys);
    const dbRequiredKeySet = new Set(
      dbRequiredRows.map((r) => `${r.rulePackKey}::${r.entityType}::${r.fieldPath}`),
    );
    const canonicalRequiredCatalogCount = [...requiredKeySet].filter((k) => dbRequiredKeySet.has(k)).length;
    const enforcedRequiredCount = dbRequiredRows.filter((r) => r.required).length;

    return {
      taxonomy: {
        subcategoryCount,
        configuredCount: configCount,
        overlayCount,
        requiredFieldCount,
        missingConfigCount,
        complete: missingConfigCount === 0,
        canonicalExpectedSubcategoryCount: taxonomyIds.length,
        canonicalExpectedConfiguredCount: mappingIds.length,
        canonicalSubcategoryCount,
        canonicalConfiguredCount,
        canonicalComplete:
          canonicalSubcategoryCount === taxonomyIds.length
          && canonicalConfiguredCount === mappingIds.length,
        canonicalMappingCoverageOk:
          [...canonicalMappingSet].every((id) => canonicalIdSet.has(id)),
        canonicalExpectedRequiredFieldCatalogCount: requiredFieldKeys.length,
        canonicalRequiredFieldCatalogCount: canonicalRequiredCatalogCount,
        canonicalRequiredFieldCatalogComplete:
          canonicalRequiredCatalogCount === requiredFieldKeys.length,
        enforcedRequiredCount,
        completeFamilyCoverage,
      },
      familyCoverage,
      missingConfigRows,
    };
  }
}
