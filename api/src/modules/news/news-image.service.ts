import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../../database/prisma.service';
import { StorageService, StorageObject } from '../../storage/storage.service';
import {
  detectImageType,
  type DetectedImage,
} from '../../common/image-signature.util';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';
import { newsAuditSnapshot } from '../audit/audit.snapshots';
import { NewsService } from './news.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const OPTIMIZED_MAX_WIDTH = 1920;
const THUMBNAIL_MAX_SIDE = 480;

type ImageVariant = 'optimized' | 'thumbnail';

interface ProcessedImage {
  optimized: Buffer;
  thumbnail: Buffer;
}

@Injectable()
export class NewsImageService {
  private readonly logger = new Logger(NewsImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly newsService: NewsService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    newsId: string,
    file: Express.Multer.File | undefined,
    adminId: string,
  ) {
    const news = await this.prisma.news.findUnique({
      where: { id: newsId },
      include: { image: true },
    });
    if (!news) {
      throw new NotFoundException('News not found');
    }
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Файл изображения обязателен.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Максимальный размер файла — 10 МБ.');
    }

    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('Допустимы изображения JPG и PNG.');
    }

    const processed = await this.process(file.buffer, detected);
    const ext = detected === 'jpeg' ? 'jpg' : 'png';
    const contentType = detected === 'jpeg' ? 'image/jpeg' : 'image/png';
    const prefix = `news/${newsId}/${randomUUID()}`;
    const originalKey = `${prefix}/original.${ext}`;
    const optimizedKey = `${prefix}/optimized.${ext}`;
    const thumbnailKey = `${prefix}/thumbnail.${ext}`;

    await this.storage.putObject(originalKey, file.buffer, contentType);
    await this.storage.putObject(optimizedKey, processed.optimized, contentType);
    await this.storage.putObject(thumbnailKey, processed.thumbnail, contentType);

    const previous = news.image;
    const previousKeys = previous
      ? [previous.originalKey, previous.optimizedKey, previous.thumbnailKey]
      : [];
    const action = previous
      ? AUDIT_ACTIONS.NEWS_IMAGE_REPLACED
      : AUDIT_ACTIONS.NEWS_IMAGE_ADDED;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (previous) {
          await tx.newsImage.delete({ where: { newsId } });
        }
        await tx.newsImage.create({
          data: {
            newsId,
            originalKey,
            optimizedKey,
            thumbnailKey,
            mimeType: contentType,
            size: file.size,
          },
        });
        const updated = await tx.news.update({
          where: { id: newsId },
          data: { updatedAt: new Date() },
        });
        await this.audit.write(
          {
            actorId: adminId,
            action,
            entityType: AUDIT_ENTITIES.NEWS,
            entityId: newsId,
            beforeJson: newsAuditSnapshot(news, Boolean(previous)),
            afterJson: newsAuditSnapshot(updated, true),
          },
          tx,
        );
      });
    } catch (error) {
      await this.storage.deleteObjects([originalKey, optimizedKey, thumbnailKey]);
      this.logger.error(
        `Failed to persist image for news ${newsId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        'Не удалось загрузить изображение.',
      );
    }

    if (previousKeys.length > 0 && previousKeys[0] !== originalKey) {
      await this.storage.deleteObjects(previousKeys);
    }

    return this.newsService.findOne(newsId);
  }

  async remove(newsId: string, adminId: string) {
    const news = await this.prisma.news.findUnique({
      where: { id: newsId },
      include: { image: true },
    });
    if (!news) {
      throw new NotFoundException('News not found');
    }
    if (!news.image) {
      return this.newsService.findOne(newsId);
    }

    const image = news.image;
    await this.prisma.$transaction(async (tx) => {
      await tx.newsImage.delete({ where: { newsId } });
      const updated = await tx.news.update({
        where: { id: newsId },
        data: { updatedAt: new Date() },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.NEWS_IMAGE_REMOVED,
          entityType: AUDIT_ENTITIES.NEWS,
          entityId: newsId,
          beforeJson: newsAuditSnapshot(news, true),
          afterJson: newsAuditSnapshot(updated, false),
        },
        tx,
      );
    });

    await this.storage.deleteObjects([
      image.originalKey,
      image.optimizedKey,
      image.thumbnailKey,
    ]);

    return this.newsService.findOne(newsId);
  }

  async getAdminVariant(newsId: string, variant: string): Promise<StorageObject> {
    this.assertVariant(variant);
    const image = await this.prisma.newsImage.findUnique({ where: { newsId } });
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    return this.storage.getObject(this.keyFor(image, variant as ImageVariant));
  }

  async getPublicVariant(slug: string, variant: string): Promise<StorageObject> {
    this.assertVariant(variant);
    const news = await this.prisma.news.findUnique({
      where: { slug },
      include: { image: true },
    });
    if (!news || news.status !== 'PUBLISHED' || !news.image) {
      throw new NotFoundException('Image not found');
    }
    return this.storage.getObject(
      this.keyFor(news.image, variant as ImageVariant),
    );
  }

  private keyFor(
    image: { optimizedKey: string; thumbnailKey: string },
    variant: ImageVariant,
  ): string {
    return variant === 'optimized' ? image.optimizedKey : image.thumbnailKey;
  }

  private assertVariant(variant: string): asserts variant is ImageVariant {
    if (variant !== 'optimized' && variant !== 'thumbnail') {
      throw new NotFoundException('Image variant not found');
    }
  }

  private async process(
    buffer: Buffer,
    format: DetectedImage,
  ): Promise<ProcessedImage> {
    const optimizedPipeline = sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: OPTIMIZED_MAX_WIDTH, withoutEnlargement: true });
    const thumbnailPipeline = sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_SIDE,
        height: THUMBNAIL_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      });

    if (format === 'jpeg') {
      const [optimized, thumbnail] = await Promise.all([
        optimizedPipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
        thumbnailPipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
      ]);
      return { optimized, thumbnail };
    }

    const [optimized, thumbnail] = await Promise.all([
      optimizedPipeline.png({ compressionLevel: 9 }).toBuffer(),
      thumbnailPipeline.png({ compressionLevel: 9 }).toBuffer(),
    ]);
    return { optimized, thumbnail };
  }
}
