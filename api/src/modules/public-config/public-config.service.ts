import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicDistrict {
  id: string;
  name: string;
}

export const PUBLIC_FEATURE_FLAGS = [
  'PUBLIC_CATALOG',
  'PUBLIC_SUBMISSION',
  'VOTING',
  'RESULTS',
] as const;

export type FeatureFlagKey = (typeof PUBLIC_FEATURE_FLAGS)[number];

export type PublicFeatures = Record<FeatureFlagKey, boolean>;

export interface PublicConfig {
  categories: PublicCategory[];
  districts: PublicDistrict[];
  features: PublicFeatures;
}

@Injectable()
export class PublicConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<PublicConfig> {
    const [categories, districts, settings] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.district.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.systemSetting.findMany({
        where: { key: { in: [...PUBLIC_FEATURE_FLAGS] } },
      }),
    ]);

    const valueByKey = new Map(settings.map((s) => [s.key, s.value]));

    const features = PUBLIC_FEATURE_FLAGS.reduce((acc, key) => {
      acc[key] = valueByKey.get(key) === true;
      return acc;
    }, {} as PublicFeatures);

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      districts: districts.map((d) => ({ id: d.id, name: d.name })),
      features,
    };
  }
}
