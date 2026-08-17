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
import { IdeasService } from './ideas.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';
import { ideaAuditSnapshot } from '../audit/audit.snapshots';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const OPTIMIZED_MAX_WIDTH = 1920;
const THUMBNAIL_MAX_SIDE = 480;

type ImageVariant = 'optimized' | 'thumbnail';

interface ProcessedImage {
  optimized: Buffer;
  thumbnail: Buffer;
}

@Injectable()
export class IdeaImageService {
  private readonly logger = new Logger(IdeaImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ideasService: IdeasService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    ideaId: string,
    file: Express.Multer.File | undefined,
    adminId: string,
  ) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: { image: true, districts: true },
    });
    if (!idea) {
      throw new NotFoundException('Initiative not found');
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
    const prefix = `ideas/${ideaId}/${randomUUID()}`;
    const originalKey = `${prefix}/original.${ext}`;
    const optimizedKey = `${prefix}/optimized.${ext}`;
    const thumbnailKey = `${prefix}/thumbnail.${ext}`;

    // 1-2. New objects are uploaded first; the DB still points at the old ones.
    await this.storage.putObject(originalKey, file.buffer, contentType);
    await this.storage.putObject(optimizedKey, processed.optimized, contentType);
    await this.storage.putObject(thumbnailKey, processed.thumbnail, contentType);

    const previous = idea.image;
    const previousKeys = previous
      ? [previous.originalKey, previous.optimizedKey, previous.thumbnailKey]
      : [];
    const reason = previous ? 'Изображение заменено' : 'Добавлено изображение';
    const action = previous
      ? AUDIT_ACTIONS.IDEA_IMAGE_REPLACED
      : AUDIT_ACTIONS.IDEA_IMAGE_ADDED;
    const districtIds = idea.districts.map((d) => d.districtId);

    // 3. Only after successful upload do we switch the DB metadata + revision.
    try {
      await this.prisma.$transaction(async (tx) => {
        if (previous) {
          await tx.ideaImage.delete({ where: { ideaId } });
        }
        await tx.ideaImage.create({
          data: {
            ideaId,
            originalKey,
            optimizedKey,
            thumbnailKey,
            mimeType: contentType,
            size: file.size,
          },
        });
        const updated = await tx.idea.update({
          where: { id: ideaId },
          data: { updatedAt: new Date() },
        });
        await tx.ideaRevision.create({
          data: {
            ideaId,
            actorAdminId: adminId,
            reason,
            snapshotJson: {
              ...(this.ideasService.revisionSnapshot(
                updated,
                districtIds,
              ) as object),
              hasImage: true,
            },
          },
        });
        await this.audit.write(
          {
            actorId: adminId,
            action,
            entityType: AUDIT_ENTITIES.IDEA,
            entityId: ideaId,
            beforeJson: {
              ...ideaAuditSnapshot(idea, districtIds, Boolean(previous)),
              mimeType: previous?.mimeType ?? null,
              size: previous?.size ?? null,
            },
            afterJson: {
              ...ideaAuditSnapshot(updated, districtIds, true),
              mimeType: contentType,
              size: file.size,
            },
          },
          tx,
        );
      });
    } catch (error) {
      // 4. DB update failed: remove the just-uploaded orphan objects.
      await this.storage.deleteObjects([originalKey, optimizedKey, thumbnailKey]);
      this.logger.error(
        `Failed to persist image for idea ${ideaId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Не удалось загрузить изображение.');
    }

    // 5. New image is committed; clean up the replaced objects (best-effort).
    if (previousKeys.length > 0 && previousKeys[0] !== originalKey) {
      await this.storage.deleteObjects(previousKeys);
    }

    return this.ideasService.findOne(ideaId);
  }

  async remove(ideaId: string, adminId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: { image: true, districts: true },
    });
    if (!idea) {
      throw new NotFoundException('Initiative not found');
    }
    if (!idea.image) {
      // Nothing to delete: idempotent, no revision.
      return this.ideasService.findOne(ideaId);
    }

    const image = idea.image;
    const districtIds = idea.districts.map((d) => d.districtId);

    await this.prisma.$transaction(async (tx) => {
      await tx.ideaImage.delete({ where: { ideaId } });
      const updated = await tx.idea.update({
        where: { id: ideaId },
        data: { updatedAt: new Date() },
      });
      await tx.ideaRevision.create({
        data: {
          ideaId,
          actorAdminId: adminId,
          reason: 'Изображение удалено',
          snapshotJson: {
            ...(this.ideasService.revisionSnapshot(
              updated,
              districtIds,
            ) as object),
            hasImage: false,
          },
        },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.IDEA_IMAGE_REMOVED,
          entityType: AUDIT_ENTITIES.IDEA,
          entityId: ideaId,
          beforeJson: {
            ...ideaAuditSnapshot(idea, districtIds, true),
            mimeType: image.mimeType,
            size: image.size,
          },
          afterJson: ideaAuditSnapshot(updated, districtIds, false),
        },
        tx,
      );
    });

    await this.storage.deleteObjects([
      image.originalKey,
      image.optimizedKey,
      image.thumbnailKey,
    ]);

    return this.ideasService.findOne(ideaId);
  }

  async getVariant(
    ideaId: string,
    variant: string,
  ): Promise<StorageObject> {
    if (variant !== 'optimized' && variant !== 'thumbnail') {
      throw new NotFoundException('Image variant not found');
    }
    const image = await this.prisma.ideaImage.findUnique({ where: { ideaId } });
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    const key: string =
      (variant as ImageVariant) === 'optimized'
        ? image.optimizedKey
        : image.thumbnailKey;
    return this.storage.getObject(key);
  }

  /**
   * Produces web-optimized and thumbnail buffers. `rotate()` bakes in the EXIF
   * orientation and, because metadata is not re-attached, sharp drops EXIF/GPS.
   * Small images are never upscaled.
   */
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
