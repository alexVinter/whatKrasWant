import { Injectable, NotFoundException } from '@nestjs/common';
import { IdeaStatus, TerritoryType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageObject } from '../../storage/storage.service';
import { IdeaImageService } from '../ideas/idea-image.service';
import { SettingsService } from '../settings/settings.service';
import { ListPublicIdeasDto } from './dto/list-public-ideas.dto';
import {
  DEFAULT_PUBLIC_IDEAS_PAGE,
  DEFAULT_PUBLIC_IDEAS_PAGE_SIZE,
  RELEASE1_VOTE_COUNT,
} from './public-ideas.constants';

type IdeaListRow = {
  slug: string;
  title: string;
  description: string;
  expertName: string | null;
  territoryType: TerritoryType;
  address: string | null;
  publishedAt: Date | null;
  image: { id: string } | null;
  districts: { district: { name: string } }[];
};

type IdeaDetailRow = IdeaListRow & {
  description: string;
  latitude: number | null;
  longitude: number | null;
};

@Injectable()
export class PublicIdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly ideaImages: IdeaImageService,
  ) {}

  async list(query: ListPublicIdeasDto) {
    await this.assertCatalogEnabled();

    const page = query.page ?? DEFAULT_PUBLIC_IDEAS_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PUBLIC_IDEAS_PAGE_SIZE;
    const where = { status: IdeaStatus.PUBLISHED };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.idea.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { slug: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          slug: true,
          title: true,
          description: true,
          expertName: true,
          territoryType: true,
          address: true,
          publishedAt: true,
          image: { select: { id: true } },
          districts: {
            include: { district: { select: { name: true } } },
          },
        },
      }),
      this.prisma.idea.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toListItem(row)),
      page,
      pageSize,
      total,
    };
  }

  async findBySlug(slug: string) {
    await this.assertCatalogEnabled();

    const idea = await this.prisma.idea.findUnique({
      where: { slug },
      include: {
        image: { select: { id: true } },
        districts: {
          include: { district: { select: { name: true } } },
        },
      },
    });

    if (!idea || idea.status !== IdeaStatus.PUBLISHED) {
      throw new NotFoundException('Initiative not found');
    }

    return this.toDetail(idea);
  }

  async listMapMarkers() {
    await this.assertCatalogEnabled();

    const rows = await this.prisma.idea.findMany({
      where: {
        status: IdeaStatus.PUBLISHED,
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: [{ publishedAt: 'desc' }, { slug: 'asc' }],
      select: {
        slug: true,
        title: true,
        expertName: true,
        latitude: true,
        longitude: true,
        image: { select: { id: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        authorName: this.authorName(row.expertName),
        latitude: row.latitude as number,
        longitude: row.longitude as number,
        thumbnailUrl: row.image
          ? `/api/public/ideas/${row.slug}/image/thumbnail?v=${row.image.id}`
          : null,
      })),
    };
  }

  async getImageVariant(
    slug: string,
    variant: string,
  ): Promise<StorageObject> {
    await this.assertCatalogEnabled();
    return this.ideaImages.getPublicVariant(slug, variant);
  }

  private async assertCatalogEnabled(): Promise<void> {
    const flags = await this.settings.get();
    if (!flags.PUBLIC_CATALOG) {
      throw new NotFoundException('Initiative not found');
    }
  }

  private toListItem(row: IdeaListRow) {
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      authorName: this.authorName(row.expertName),
      publishedAt: row.publishedAt,
      territory: this.listTerritory(row),
      voteCount: RELEASE1_VOTE_COUNT,
      thumbnailUrl: row.image
        ? `/api/public/ideas/${row.slug}/image/thumbnail?v=${row.image.id}`
        : null,
    };
  }

  private toDetail(idea: IdeaDetailRow) {
    return {
      slug: idea.slug,
      title: idea.title,
      description: idea.description,
      authorName: this.authorName(idea.expertName),
      territory: this.detailTerritory(idea),
      address: idea.address,
      latitude: idea.latitude,
      longitude: idea.longitude,
      publishedAt: idea.publishedAt,
      voteCount: RELEASE1_VOTE_COUNT,
      image: idea.image
        ? {
            url: `/api/public/ideas/${idea.slug}/image/optimized?v=${idea.image.id}`,
          }
        : null,
    };
  }

  private authorName(expertName: string | null): string {
    return expertName?.trim() || '—';
  }

  private districtLabel(row: Pick<IdeaListRow, 'territoryType' | 'districts'>): string | null {
    if (row.territoryType === TerritoryType.CITYWIDE) {
      return 'Весь город';
    }
    const names = row.districts.map((d) => d.district.name);
    return names.length > 0 ? names.join(', ') : null;
  }

  private listTerritory(row: IdeaListRow): string | null {
    const district = this.districtLabel(row);
    if (district && row.address) {
      return `${district} — ${row.address}`;
    }
    return district ?? row.address;
  }

  private detailTerritory(row: IdeaListRow): string | null {
    const district = this.districtLabel(row);
    if (district && row.address) {
      return `${district} · ${row.address}`;
    }
    return district ?? row.address;
  }
}
