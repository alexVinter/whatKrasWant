import { Injectable } from '@nestjs/common';
import { IdeaStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

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
  districts: PublicDistrict[];
  features: PublicFeatures;
  collectedIdeasCount: number;
}

@Injectable()
export class PublicConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<PublicConfig> {
    const [districts, settings, collectedIdeasCount] = await Promise.all([
      this.prisma.district.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.systemSetting.findMany({
        where: { key: { in: [...PUBLIC_FEATURE_FLAGS] } },
      }),
      this.prisma.idea.count({
        where: { status: IdeaStatus.PUBLISHED },
      }),
    ]);

    const valueByKey = new Map(settings.map((s) => [s.key, s.value]));

    const features = PUBLIC_FEATURE_FLAGS.reduce((acc, key) => {
      acc[key] = valueByKey.get(key) === true;
      return acc;
    }, {} as PublicFeatures);

    return {
      districts: districts.map((d) => ({ id: d.id, name: d.name })),
      features,
      collectedIdeasCount,
    };
  }
}
