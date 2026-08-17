import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IdeaStatus, Prisma, TerritoryType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { slugify } from '../../common/slug.util';
import { CreateIdeaDto, IdeaCreateAction } from './dto/create-idea.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';
import { ListIdeasDto } from './dto/list-ideas.dto';

const DEFAULT_PAGE_SIZE = 20;

interface PlacementResult {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

@Injectable()
export class IdeasService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Queries ----------

  async list(query: ListIdeasDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.IdeaWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { expertName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.territory === 'CITYWIDE') {
      where.territoryType = TerritoryType.CITYWIDE;
    } else if (query.territory) {
      where.districts = { some: { districtId: query.territory } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.idea.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          districts: {
            include: { district: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.idea.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        publicNumber: row.publicNumber,
        title: row.title,
        sourceType: row.sourceType,
        expertName: row.expertName,
        category: row.category,
        territoryType: row.territoryType,
        districts: row.districts.map((d) => d.district),
        status: row.status,
        updatedAt: row.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async summary() {
    const [total, draft, published, archived] = await this.prisma.$transaction([
      this.prisma.idea.count(),
      this.prisma.idea.count({ where: { status: IdeaStatus.DRAFT } }),
      this.prisma.idea.count({ where: { status: IdeaStatus.PUBLISHED } }),
      this.prisma.idea.count({ where: { status: IdeaStatus.ARCHIVED } }),
    ]);
    return { total, draft, published, archived };
  }

  async findOne(id: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
        districts: {
          include: { district: { select: { id: true, name: true } } },
        },
        image: true,
      },
    });
    if (!idea) {
      throw new NotFoundException('Initiative not found');
    }

    return {
      id: idea.id,
      publicNumber: idea.publicNumber,
      slug: idea.slug,
      sourceType: idea.sourceType,
      expertName: idea.expertName,
      expertOrg: idea.expertOrg,
      title: idea.title,
      description: idea.description,
      categoryId: idea.categoryId,
      category: idea.category,
      territoryType: idea.territoryType,
      districts: idea.districts.map((d) => d.district),
      districtIds: idea.districts.map((d) => d.district.id),
      hasSpecificPlace: idea.address !== null,
      address: idea.address,
      latitude: idea.latitude,
      longitude: idea.longitude,
      status: idea.status,
      isTop20: idea.isTop20,
      publishedAt: idea.publishedAt,
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
      image: this.buildImage(id, idea.image),
    };
  }

  /**
   * Safe, frontend-facing image descriptor. Storage keys and S3 credentials
   * are never exposed; the frontend loads bytes through the guarded media
   * endpoint. The `v` cache-buster changes whenever the image is replaced.
   */
  private buildImage(
    ideaId: string,
    image: { id: string } | null,
  ): { id: string; url: string; thumbnailUrl: string } | null {
    if (!image) {
      return null;
    }
    return {
      id: image.id,
      url: `/api/admin/ideas/${ideaId}/image/optimized?v=${image.id}`,
      thumbnailUrl: `/api/admin/ideas/${ideaId}/image/thumbnail?v=${image.id}`,
    };
  }

  async revisions(id: string) {
    const idea = await this.prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      throw new NotFoundException('Initiative not found');
    }

    const revisions = await this.prisma.ideaRevision.findMany({
      where: { ideaId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, login: true } } },
    });

    return revisions.map((revision) => ({
      id: revision.id,
      reason: revision.reason,
      createdAt: revision.createdAt,
      actor: revision.actor
        ? { id: revision.actor.id, login: revision.actor.login }
        : null,
      snapshot: revision.snapshotJson,
    }));
  }

  // ---------- Commands ----------

  async create(dto: CreateIdeaDto, adminId: string) {
    const willPublish = dto.action === IdeaCreateAction.PUBLISH;

    const placement = this.resolvePlacement(
      dto.hasSpecificPlace,
      dto.address,
      dto.latitude,
      dto.longitude,
    );
    const districtIds = await this.resolveDistrictIds(
      dto.territoryType,
      dto.districtIds,
      willPublish,
    );
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId, willPublish);
    } else if (willPublish) {
      throw new BadRequestException(
        'Для публикации необходимо выбрать категорию.',
      );
    }

    const slug = await this.buildUniqueSlug(dto.title);
    const now = new Date();
    const status = willPublish ? IdeaStatus.PUBLISHED : IdeaStatus.DRAFT;

    const created = await this.prisma.$transaction(async (tx) => {
      const idea = await tx.idea.create({
        data: {
          slug,
          sourceType: 'EXPERT',
          expertName: dto.expertName ?? null,
          expertOrg: dto.expertOrg ?? null,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId ?? null,
          territoryType: dto.territoryType,
          address: placement.address,
          latitude: placement.latitude,
          longitude: placement.longitude,
          status,
          publishedAt: willPublish ? now : null,
        },
      });

      if (districtIds.length > 0) {
        await tx.ideaDistrict.createMany({
          data: districtIds.map((districtId) => ({
            ideaId: idea.id,
            districtId,
          })),
        });
      }

      await tx.ideaRevision.create({
        data: {
          ideaId: idea.id,
          actorAdminId: adminId,
          reason: willPublish
            ? 'Инициатива создана и опубликована'
            : 'Инициатива создана',
          snapshotJson: this.snapshot(idea, districtIds),
        },
      });

      return idea;
    });

    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateIdeaDto, adminId: string) {
    const existing = await this.prisma.idea.findUnique({
      where: { id },
      include: { districts: true },
    });
    if (!existing) {
      throw new NotFoundException('Initiative not found');
    }

    const existingDistrictIds = existing.districts
      .map((d) => d.districtId)
      .sort();

    const next = {
      expertName:
        dto.expertName !== undefined ? dto.expertName : existing.expertName,
      expertOrg:
        dto.expertOrg !== undefined ? dto.expertOrg : existing.expertOrg,
      title: dto.title ?? existing.title,
      description: dto.description ?? existing.description,
      categoryId:
        dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
      territoryType: dto.territoryType ?? existing.territoryType,
      hasSpecificPlace:
        dto.hasSpecificPlace !== undefined
          ? dto.hasSpecificPlace
          : existing.address !== null,
    };

    const districtIdsInput =
      dto.districtIds !== undefined ? dto.districtIds : existingDistrictIds;

    const placement = this.resolvePlacement(
      next.hasSpecificPlace,
      dto.address !== undefined ? dto.address : existing.address ?? undefined,
      dto.latitude !== undefined ? dto.latitude : existing.latitude ?? undefined,
      dto.longitude !== undefined
        ? dto.longitude
        : existing.longitude ?? undefined,
    );

    const nextDistrictIds = await this.resolveDistrictIds(
      next.territoryType,
      districtIdsInput,
      false,
    );
    if (next.categoryId) {
      await this.assertCategoryExists(next.categoryId, false);
    }

    const sortedNextDistrictIds = [...nextDistrictIds].sort();
    const districtsChanged =
      JSON.stringify(existingDistrictIds) !==
      JSON.stringify(sortedNextDistrictIds);

    const fieldsChanged =
      next.expertName !== existing.expertName ||
      next.expertOrg !== existing.expertOrg ||
      next.title !== existing.title ||
      next.description !== existing.description ||
      next.categoryId !== existing.categoryId ||
      next.territoryType !== existing.territoryType ||
      placement.address !== existing.address ||
      placement.latitude !== existing.latitude ||
      placement.longitude !== existing.longitude;

    if (!fieldsChanged && !districtsChanged) {
      return this.findOne(id);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: {
          expertName: next.expertName,
          expertOrg: next.expertOrg,
          title: next.title,
          description: next.description,
          categoryId: next.categoryId,
          territoryType: next.territoryType,
          address: placement.address,
          latitude: placement.latitude,
          longitude: placement.longitude,
        },
      });

      if (districtsChanged) {
        await tx.ideaDistrict.deleteMany({ where: { ideaId: id } });
        if (sortedNextDistrictIds.length > 0) {
          await tx.ideaDistrict.createMany({
            data: sortedNextDistrictIds.map((districtId) => ({
              ideaId: id,
              districtId,
            })),
          });
        }
      }

      await tx.ideaRevision.create({
        data: {
          ideaId: id,
          actorAdminId: adminId,
          reason:
            dto.reason && dto.reason.length > 0
              ? dto.reason
              : 'Инициатива изменена',
          snapshotJson: this.snapshot(updated, sortedNextDistrictIds),
        },
      });
    });

    return this.findOne(id);
  }

  async publish(id: string, adminId: string) {
    const existing = await this.prisma.idea.findUnique({
      where: { id },
      include: { districts: true },
    });
    if (!existing) {
      throw new NotFoundException('Initiative not found');
    }
    if (existing.status === IdeaStatus.PUBLISHED) {
      return this.findOne(id);
    }
    if (existing.status === IdeaStatus.ARCHIVED) {
      throw new BadRequestException(
        'Сначала восстановите инициативу из архива.',
      );
    }

    this.assertLengths(existing.title, existing.description);
    await this.assertCategoryExists(existing.categoryId, true);

    const districtIds = existing.districts.map((d) => d.districtId);
    await this.resolveDistrictIds(existing.territoryType, districtIds, true);

    if (existing.address !== null) {
      if (existing.latitude === null || existing.longitude === null) {
        throw new BadRequestException('Укажите координаты геометки.');
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: {
          status: IdeaStatus.PUBLISHED,
          publishedAt: existing.publishedAt ?? now,
        },
      });
      await tx.ideaRevision.create({
        data: {
          ideaId: id,
          actorAdminId: adminId,
          reason: 'Инициатива опубликована',
          snapshotJson: this.snapshot(updated, districtIds),
        },
      });
    });

    return this.findOne(id);
  }

  async unpublish(id: string, adminId: string) {
    const existing = await this.prisma.idea.findUnique({
      where: { id },
      include: { districts: true },
    });
    if (!existing) {
      throw new NotFoundException('Initiative not found');
    }
    if (existing.status !== IdeaStatus.PUBLISHED) {
      throw new BadRequestException(
        'Снять с публикации можно только опубликованную инициативу.',
      );
    }

    const districtIds = existing.districts.map((d) => d.districtId);
    // publishedAt is preserved as the historical publication date (see report).
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: { status: IdeaStatus.DRAFT },
      });
      await tx.ideaRevision.create({
        data: {
          ideaId: id,
          actorAdminId: adminId,
          reason: 'Инициатива снята с публикации',
          snapshotJson: this.snapshot(updated, districtIds),
        },
      });
    });

    return this.findOne(id);
  }

  async archive(id: string, adminId: string) {
    const existing = await this.prisma.idea.findUnique({
      where: { id },
      include: { districts: true },
    });
    if (!existing) {
      throw new NotFoundException('Initiative not found');
    }
    if (existing.status === IdeaStatus.ARCHIVED) {
      return this.findOne(id);
    }

    const districtIds = existing.districts.map((d) => d.districtId);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: { status: IdeaStatus.ARCHIVED },
      });
      await tx.ideaRevision.create({
        data: {
          ideaId: id,
          actorAdminId: adminId,
          reason: 'Инициатива архивирована',
          snapshotJson: this.snapshot(updated, districtIds),
        },
      });
    });

    return this.findOne(id);
  }

  async restore(id: string, adminId: string) {
    const existing = await this.prisma.idea.findUnique({
      where: { id },
      include: { districts: true },
    });
    if (!existing) {
      throw new NotFoundException('Initiative not found');
    }
    if (existing.status !== IdeaStatus.ARCHIVED) {
      throw new BadRequestException(
        'Восстановить можно только архивную инициативу.',
      );
    }

    const districtIds = existing.districts.map((d) => d.districtId);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.idea.update({
        where: { id },
        data: { status: IdeaStatus.DRAFT },
      });
      await tx.ideaRevision.create({
        data: {
          ideaId: id,
          actorAdminId: adminId,
          reason: 'Инициатива восстановлена',
          snapshotJson: this.snapshot(updated, districtIds),
        },
      });
    });

    return this.findOne(id);
  }

  // ---------- Helpers ----------

  /** Public revision-snapshot builder reused by the image service. */
  revisionSnapshot(
    idea: Parameters<IdeasService['snapshot']>[0],
    districtIds: string[],
  ): Prisma.InputJsonValue {
    return this.snapshot(idea, districtIds);
  }

  private assertLengths(title: string, description: string) {
    if (title.length < 10 || title.length > 150) {
      throw new BadRequestException('Название должно быть от 10 до 150 символов.');
    }
    if (description.length < 50 || description.length > 3000) {
      throw new BadRequestException(
        'Описание должно быть от 50 до 3000 символов.',
      );
    }
  }

  private resolvePlacement(
    hasSpecificPlace: boolean,
    address?: string | null,
    latitude?: number | null,
    longitude?: number | null,
  ): PlacementResult {
    if (!hasSpecificPlace) {
      return { address: null, latitude: null, longitude: null };
    }
    if (!address || address.trim().length === 0) {
      throw new BadRequestException('Укажите адрес для конкретного места.');
    }
    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      throw new BadRequestException('Укажите координаты геометки.');
    }
    return { address, latitude, longitude };
  }

  private async resolveDistrictIds(
    territoryType: TerritoryType,
    districtIds: string[] | undefined,
    requireActive: boolean,
  ): Promise<string[]> {
    if (territoryType === TerritoryType.CITYWIDE) {
      return [];
    }
    const ids = districtIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestException(
        'Выберите хотя бы один район или «Весь город».',
      );
    }
    const found = await this.prisma.district.findMany({
      where: { id: { in: ids } },
    });
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException('Некоторые районы не найдены.');
    }
    if (requireActive && found.some((d) => !d.isActive)) {
      throw new BadRequestException(
        'Нельзя опубликовать инициативу с неактивным районом.',
      );
    }
    return [...new Set(ids)];
  }

  private async assertCategoryExists(
    categoryId: string | null,
    requireActive: boolean,
  ) {
    if (!categoryId) {
      throw new BadRequestException(
        'Для публикации необходимо выбрать категорию.',
      );
    }
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException('Категория не найдена.');
    }
    if (requireActive && !category.isActive) {
      throw new BadRequestException(
        'Категория неактивна. Выберите активную категорию.',
      );
    }
  }

  private async buildUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let suffix = 2;
    while (await this.prisma.idea.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  private snapshot(
    idea: {
      title: string;
      description: string;
      categoryId: string | null;
      territoryType: TerritoryType;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      status: IdeaStatus;
      expertName: string | null;
      expertOrg: string | null;
    },
    districtIds: string[],
  ): Prisma.InputJsonValue {
    return {
      title: idea.title,
      description: idea.description,
      categoryId: idea.categoryId,
      territoryType: idea.territoryType,
      districtIds,
      address: idea.address,
      latitude: idea.latitude,
      longitude: idea.longitude,
      status: idea.status,
      expertName: idea.expertName,
      expertOrg: idea.expertOrg,
    };
  }
}
