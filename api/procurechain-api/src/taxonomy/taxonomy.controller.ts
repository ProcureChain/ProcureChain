import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { TaxonomyService } from './taxonomy.service';

@Controller('taxonomy')
@UseGuards(TenantGuard)
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get('subcategories')
  async subcategories(
    @Query('q') q?: string,
    @Query('archetype') archetype?: string,
    @Query('limit') limit?: string,
    @Query('canonicalOnly') canonicalOnly?: string,
  ) {
    return this.taxonomy.subcategories(
      q,
      archetype,
      limit ? Number(limit) : 100,
      canonicalOnly === 'true',
    );
  }

  @Get('effective-config')
  async effectiveConfig(
    @Query('subcategoryId') subcategoryId?: string,
    @Query('country') country?: string,
  ) {
    if (!subcategoryId?.trim()) {
      throw new BadRequestException('subcategoryId is required');
    }
    return this.taxonomy.resolveEffectiveConfig(subcategoryId.trim(), country);
  }

  @Get('pr-form-schema')
  async prFormSchema(
    @Query('subcategoryId') subcategoryId?: string,
    @Query('country') country?: string,
  ) {
    if (!subcategoryId?.trim()) {
      throw new BadRequestException('subcategoryId is required');
    }
    return this.taxonomy.resolvePrFormSchema(subcategoryId.trim(), country);
  }

  @Get('integrity')
  async integrity() {
    return this.taxonomy.integrity();
  }

  @Get('location-suggest')
  async locationSuggest(
    @Query('q') q?: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ) {
    if (!q?.trim()) {
      throw new BadRequestException('q is required');
    }
    return this.taxonomy.locationSuggest(q.trim(), country, limit ? Number(limit) : 5);
  }
}
