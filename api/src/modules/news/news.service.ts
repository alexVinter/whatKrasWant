import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NewsStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { slugify } from '../../common/slug.util';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';
import { newsAuditSnapshot } from '../audit/audit.snapshots';
import { CreateNewsDto, NewsCreateAction } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { ListPublicNewsDto } from './dto/list-public-news.dto';
import {
  DEFAULT_PUBLIC_NEWS_PAGE,
  DEFAULT_PUBLIC_NEWS_PAGE_SIZE,
} from './news.constants';

type NewsWithImage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  publishDate: Date | null;
  status: NewsStatus;
  createdAt: Date;
  updatedAt: Date;
  image: { id: string } | null;
};

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAdmin() {
    const rows = await this.prisma.news.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        publishDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { items: rows };
  }

  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
      include: { image: true },
    });
    if (!news) {
      throw new NotFoundException('News not found');
    }
    return this.toAdminDetail(news);
  }

  async create(dto: CreateNewsDto, adminId: string) {
    const publishDate = this.parseDate(dto.publishDate);
    const willPublish = dto.action === NewsCreateAction.PUBLISH;
    if (willPublish) {
      this.assertPublishable(dto.title, dto.body, publishDate);
    }

    const slug = await this.buildUniqueSlug(dto.title);
    const created = await this.prisma.$transaction(async (tx) => {
      const news = await tx.news.create({
        data: {
          slug,
          title: dto.title,
          body: dto.body,
          publishDate,
          status: willPublish ? NewsStatus.PUBLISHED : NewsStatus.DRAFT,
        },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.NEWS_CREATED,
          entityType: AUDIT_ENTITIES.NEWS,
          entityId: news.id,
          afterJson: newsAuditSnapshot(news, false),
        },
        tx,
      );
      if (willPublish) {
        await this.audit.write(
          {
            actorId: adminId,
            action: AUDIT_ACTIONS.NEWS_PUBLISHED,
            entityType: AUDIT_ENTITIES.NEWS,
            entityId: news.id,
            beforeJson: newsAuditSnapshot(
              { ...news, status: NewsStatus.DRAFT },
              false,
            ),
            afterJson: newsAuditSnapshot(news, false),
          },
          tx,
        );
      }
      return news;
    });

    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateNewsDto, adminId: string) {
    const existing = await this.prisma.news.findUnique({
      where: { id },
      include: { image: true },
    });
    if (!existing) {
      throw new NotFoundException('News not found');
    }

    const nextTitle = dto.title ?? existing.title;
    const nextBody = dto.body ?? existing.body;
    const nextDate =
      dto.publishDate === undefined
        ? existing.publishDate
        : this.parseDate(dto.publishDate);

    if (
      existing.status === NewsStatus.PUBLISHED &&
      nextDate === null
    ) {
      throw new BadRequestException(
        'Для опубликованной новости дата публикации обязательна.',
      );
    }

    const unchanged =
      nextTitle === existing.title &&
      nextBody === existing.body &&
      this.sameDate(nextDate, existing.publishDate);
    if (unchanged) {
      return this.toAdminDetail(existing);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.news.update({
        where: { id },
        data: {
          title: nextTitle,
          body: nextBody,
          publishDate: nextDate,
        },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.NEWS_UPDATED,
          entityType: AUDIT_ENTITIES.NEWS,
          entityId: id,
          beforeJson: newsAuditSnapshot(existing, existing.image !== null),
          afterJson: newsAuditSnapshot(updated, existing.image !== null),
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  async publish(id: string, adminId: string) {
    const existing = await this.prisma.news.findUnique({
      where: { id },
      include: { image: true },
    });
    if (!existing) {
      throw new NotFoundException('News not found');
    }
    if (existing.status === NewsStatus.PUBLISHED) {
      return this.toAdminDetail(existing);
    }
    this.assertPublishable(existing.title, existing.body, existing.publishDate);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.news.update({
        where: { id },
        data: { status: NewsStatus.PUBLISHED },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.NEWS_PUBLISHED,
          entityType: AUDIT_ENTITIES.NEWS,
          entityId: id,
          beforeJson: newsAuditSnapshot(existing, existing.image !== null),
          afterJson: newsAuditSnapshot(updated, existing.image !== null),
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  async unpublish(id: string, adminId: string) {
    const existing = await this.prisma.news.findUnique({
      where: { id },
      include: { image: true },
    });
    if (!existing) {
      throw new NotFoundException('News not found');
    }
    if (existing.status === NewsStatus.DRAFT) {
      return this.toAdminDetail(existing);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.news.update({
        where: { id },
        data: { status: NewsStatus.DRAFT },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.NEWS_UNPUBLISHED,
          entityType: AUDIT_ENTITIES.NEWS,
          entityId: id,
          beforeJson: newsAuditSnapshot(existing, existing.image !== null),
          afterJson: newsAuditSnapshot(updated, existing.image !== null),
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  async listPublic(query: ListPublicNewsDto) {
    const page = query.page ?? DEFAULT_PUBLIC_NEWS_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PUBLIC_NEWS_PAGE_SIZE;
    const where = { status: NewsStatus.PUBLISHED };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        orderBy: [{ publishDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          slug: true,
          title: true,
          publishDate: true,
          image: { select: { id: true } },
        },
      }),
      this.prisma.news.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        publishDate: row.publishDate,
        thumbnailUrl: row.image
          ? `/api/public/news/${row.slug}/image/thumbnail?v=${row.image.id}`
          : null,
      })),
      page,
      pageSize,
      total,
    };
  }

  async findPublicBySlug(slug: string) {
    const news = await this.prisma.news.findUnique({
      where: { slug },
      include: { image: true },
    });
    if (!news || news.status !== NewsStatus.PUBLISHED) {
      throw new NotFoundException('News not found');
    }
    return {
      slug: news.slug,
      title: news.title,
      body: news.body,
      publishDate: news.publishDate,
      image: news.image
        ? {
            url: `/api/public/news/${news.slug}/image/optimized?v=${news.image.id}`,
          }
        : null,
    };
  }

  toAdminDetail(news: NewsWithImage) {
    return {
      id: news.id,
      slug: news.slug,
      title: news.title,
      body: news.body,
      publishDate: news.publishDate,
      status: news.status,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
      image: this.buildImage(news.id, news.image),
    };
  }

  private buildImage(newsId: string, image: { id: string } | null) {
    if (!image) {
      return null;
    }
    return {
      id: image.id,
      url: `/api/admin/news/${newsId}/image/optimized?v=${image.id}`,
      thumbnailUrl: `/api/admin/news/${newsId}/image/thumbnail?v=${image.id}`,
    };
  }

  private assertPublishable(
    title: string,
    body: string,
    publishDate: Date | null,
  ) {
    if (!title.trim() || !body.trim()) {
      throw new BadRequestException(
        'Для публикации заполните название и текст новости.',
      );
    }
    if (!publishDate) {
      throw new BadRequestException(
        'Для публикации укажите дату публикации.',
      );
    }
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Некорректная дата публикации.');
    }
    return parsed;
  }

  private sameDate(a: Date | null, b: Date | null): boolean {
    if (a === null && b === null) {
      return true;
    }
    if (a === null || b === null) {
      return false;
    }
    return a.getTime() === b.getTime();
  }

  private async buildUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let suffix = 2;
    while (await this.prisma.news.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}
