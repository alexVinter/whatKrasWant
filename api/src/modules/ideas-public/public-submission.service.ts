import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdeaSourceType,
  IdeaStatus,
  Prisma,
  TerritoryType,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { slugify } from '../../common/slug.util';
import { isPointInKrasnoyarsk } from '../../common/geo/is-point-in-krasnoyarsk';
import { KRASNOYARSK_GEO_ERROR } from '../../common/geo/krasnoyarsk.constants';
import { SettingsService } from '../settings/settings.service';
import { IdeaImageService } from '../ideas/idea-image.service';
import { SubmitPublicIdeaDto } from './dto/submit-public-idea.dto';

export interface PublicSubmissionResult {
  id: string;
  title: string;
  status: IdeaStatus;
  submittedAt: Date;
}

@Injectable()
export class PublicSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly ideaImages: IdeaImageService,
  ) {}

  async submit(
    dto: SubmitPublicIdeaDto,
    file: Express.Multer.File | undefined,
    user: User,
  ): Promise<PublicSubmissionResult> {
    await this.assertSubmissionEnabled();

    if (user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }

    await this.assertActiveTopic(dto.topicId);
    this.assertLengths(dto.title, dto.description);
    const placement = this.resolveRequiredPlacement(
      dto.address,
      dto.latitude,
      dto.longitude,
    );

    const authorName = `${user.firstName} ${user.lastName}`.trim();
    const slug = await this.buildUniqueSlug(dto.title);
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const idea = await tx.idea.create({
        data: {
          slug,
          sourceType: IdeaSourceType.RESIDENT,
          userId: user.id,
          expertName: authorName || null,
          title: dto.title.trim(),
          description: dto.description.trim(),
          topicId: dto.topicId,
          territoryType: TerritoryType.CITYWIDE,
          address: placement.address,
          latitude: placement.latitude,
          longitude: placement.longitude,
          status: IdeaStatus.MODERATION,
          submittedAt: now,
        },
      });

      await tx.ideaRevision.create({
        data: {
          ideaId: idea.id,
          actorAdminId: null,
          reason: 'Публичная заявка отправлена',
          snapshotJson: this.snapshot(idea),
        },
      });

      return idea;
    });

    if (file) {
      try {
        await this.ideaImages.uploadForResident(created.id, file);
      } catch (error) {
        await this.prisma.idea.delete({ where: { id: created.id } });
        throw error;
      }
    }

    return {
      id: created.id,
      title: created.title,
      status: created.status,
      submittedAt: now,
    };
  }

  private async assertSubmissionEnabled(): Promise<void> {
    const flags = await this.settings.get();
    if (!flags.PUBLIC_SUBMISSION) {
      throw new NotFoundException('Submission is not available');
    }
  }

  private async assertActiveTopic(topicId: string): Promise<void> {
    const topic = await this.prisma.ideaTopic.findFirst({
      where: { id: topicId, isActive: true },
    });
    if (!topic) {
      throw new BadRequestException('Тема не найдена.');
    }
  }

  private assertLengths(title: string, description: string): void {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle.length < 10 || trimmedTitle.length > 150) {
      throw new BadRequestException(
        'Название должно быть от 10 до 150 символов.',
      );
    }
    if (trimmedDescription.length < 50 || trimmedDescription.length > 3000) {
      throw new BadRequestException(
        'Описание должно быть от 50 до 3000 символов.',
      );
    }
  }

  private resolveRequiredPlacement(
    address: string,
    latitude: number,
    longitude: number,
  ): { address: string; latitude: number; longitude: number } {
    const trimmedAddress = address.trim();
    if (trimmedAddress.length === 0) {
      throw new BadRequestException('Укажите адрес для конкретного места.');
    }
    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      throw new BadRequestException('Укажите координаты геометки.');
    }
    if (!isPointInKrasnoyarsk(latitude, longitude)) {
      throw new BadRequestException(KRASNOYARSK_GEO_ERROR);
    }
    return { address: trimmedAddress, latitude, longitude };
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

  private snapshot(idea: {
    title: string;
    description: string;
    topicId: string | null;
    territoryType: TerritoryType;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    status: IdeaStatus;
    sourceType: IdeaSourceType;
    expertName: string | null;
    userId: string | null;
  }): Prisma.InputJsonValue {
    return {
      title: idea.title,
      description: idea.description,
      topicId: idea.topicId,
      territoryType: idea.territoryType,
      address: idea.address,
      latitude: idea.latitude,
      longitude: idea.longitude,
      status: idea.status,
      sourceType: idea.sourceType,
      expertName: idea.expertName,
      userId: idea.userId,
    };
  }
}
