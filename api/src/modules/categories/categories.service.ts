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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateCategoryDto): Promise<AdminCategory> {
    const slug = dto.slug && dto.slug.length > 0 ? dto.slug : slugify(dto.name);
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());

    try {
      const created = await this.prisma.category.create({
        data: {
          name: dto.name,
          slug,
          sortOrder,
          isActive: dto.isActive ?? true,
        },
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

  async update(id: string, dto: UpdateCategoryDto): Promise<AdminCategory> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.category.update({ where: { id }, data });
    return this.toAdmin(updated);
  }
}
