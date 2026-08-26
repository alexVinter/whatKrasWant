import { Injectable } from '@nestjs/common';
import {
  IdeaSourceType,
  IdeaStatus,
  TerritoryType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CITYWIDE_TERRITORY_ID,
  CITYWIDE_TERRITORY_NAME,
  SOURCE_LABELS,
  STATUS_LABELS,
} from './statistics.labels';
import type {
  NamedCount,
  SourceCount,
  StatisticsSummary,
  StatusCount,
} from './statistics.types';

function sortNamed(a: NamedCount, b: NamedCount): number {
  return b.count - a.count || a.name.localeCompare(b.name, 'ru');
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<StatisticsSummary> {
    const [
      expertInitiatives,
      draft,
      published,
      archived,
      withLocation,
      statusGroups,
      sourceGroups,
      citywideCount,
      districtGroups,
      districts,
    ] = await Promise.all([
      this.prisma.idea.count({
        where: { sourceType: IdeaSourceType.EXPERT },
      }),
      this.prisma.idea.count({ where: { status: IdeaStatus.DRAFT } }),
      this.prisma.idea.count({ where: { status: IdeaStatus.PUBLISHED } }),
      this.prisma.idea.count({ where: { status: IdeaStatus.ARCHIVED } }),
      this.prisma.idea.count({
        where: { latitude: { not: null }, longitude: { not: null } },
      }),
      this.prisma.idea.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.idea.groupBy({
        by: ['sourceType'],
        _count: { _all: true },
      }),
      this.prisma.idea.count({
        where: { territoryType: TerritoryType.CITYWIDE },
      }),
      this.prisma.ideaDistrict.groupBy({
        by: ['districtId'],
        _count: { _all: true },
      }),
      this.prisma.district.findMany({ select: { id: true, name: true } }),
    ]);

    const statusCount = new Map(
      statusGroups.map((row) => [row.status, row._count._all]),
    );
    const byStatus: StatusCount[] = (
      Object.keys(STATUS_LABELS) as IdeaStatus[]
    ).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: statusCount.get(status) ?? 0,
    }));

    const sourceCount = new Map(
      sourceGroups.map((row) => [row.sourceType, row._count._all]),
    );
    const bySource: SourceCount[] = (
      Object.keys(SOURCE_LABELS) as IdeaSourceType[]
    ).map((sourceType) => ({
      sourceType,
      label: SOURCE_LABELS[sourceType],
      count: sourceCount.get(sourceType) ?? 0,
    }));

    const districtCount = new Map(
      districtGroups.map((row) => [row.districtId, row._count._all]),
    );
    const byTerritory: NamedCount[] = [
      {
        id: CITYWIDE_TERRITORY_ID,
        name: CITYWIDE_TERRITORY_NAME,
        count: citywideCount,
      },
      ...districts.map((district) => ({
        id: district.id,
        name: district.name,
        count: districtCount.get(district.id) ?? 0,
      })),
    ].sort(sortNamed);

    return {
      expertInitiatives,
      draft,
      published,
      archived,
      withLocation,
      byStatus,
      bySource,
      byTerritory,
    };
  }

  async listIdeasForExport() {
    return this.prisma.idea.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        title: true,
        sourceType: true,
        expertName: true,
        expertOrg: true,
        status: true,
        territoryType: true,
        address: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        publishedAt: true,
        topic: { select: { name: true } },
        districts: {
          select: { district: { select: { name: true } } },
        },
      },
    });
  }
}
