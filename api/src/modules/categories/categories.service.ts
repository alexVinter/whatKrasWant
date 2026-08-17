import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Category } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { slugify } from '../../common/slug.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';
import { categoryAuditSnapshot } from '../audit/audit.snapshots';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toAdmin(category: Category): AdminCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async findAllForAdmin(): Promise<AdminCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toAdmin(row));
  }

  private async nextSortOrder(): Promise<number> {
    const result = await this.prisma.category.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? 0) + 1;
  }

  async create(dto: CreateCategoryDto, adminId: string): Promise<AdminCategory> {
    const slug = dto.slug && dto.slug.length > 0 ? dto.slug : slugify(dto.name);
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.category.create({
          data: {
            name: dto.name,
            slug,
            sortOrder,
            isActive: dto.isActive ?? true,
          },
        });
        await this.audit.write(
          {
            actorId: adminId,
            action: AUDIT_ACTIONS.CATEGORY_CREATED,
            entityType: AUDIT_ENTITIES.CATEGORY,
            entityId: row.id,
            afterJson: categoryAuditSnapshot(row),
          },
          tx,
        );
        return row;
      });
      return this.toAdmin(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Category with this slug already exists');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    adminId: string,
  ): Promise<AdminCategory> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const nextName = dto.name !== undefined ? dto.name : existing.name;
    const nextSortOrder =
      dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder;
    const nextIsActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;

    if (
      nextName === existing.name &&
      nextSortOrder === existing.sortOrder &&
      nextIsActive === existing.isActive
    ) {
      return this.toAdmin(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.category.update({
        where: { id },
        data: {
          name: nextName,
          sortOrder: nextSortOrder,
          isActive: nextIsActive,
        },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.CATEGORY_UPDATED,
          entityType: AUDIT_ENTITIES.CATEGORY,
          entityId: id,
          beforeJson: categoryAuditSnapshot(existing),
          afterJson: categoryAuditSnapshot(row),
        },
        tx,
      );
      return row;
    });
    return this.toAdmin(updated);
  }
}
