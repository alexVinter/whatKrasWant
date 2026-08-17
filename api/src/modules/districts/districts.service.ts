import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { District } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';

export interface AdminDistrict {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  private toAdmin(district: District): AdminDistrict {
    return {
      id: district.id,
      name: district.name,
      sortOrder: district.sortOrder,
      isActive: district.isActive,
      createdAt: district.createdAt,
      updatedAt: district.updatedAt,
    };
  }

  async findAllForAdmin(): Promise<AdminDistrict[]> {
    const rows = await this.prisma.district.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toAdmin(row));
  }

  private async nextSortOrder(): Promise<number> {
    const result = await this.prisma.district.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? 0) + 1;
  }

  async create(dto: CreateDistrictDto): Promise<AdminDistrict> {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());

    try {
      const created = await this.prisma.district.create({
        data: {
          name: dto.name,
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
        throw new ConflictException('District with this name already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateDistrictDto): Promise<AdminDistrict> {
    const existing = await this.prisma.district.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('District not found');
    }

    const data: Prisma.DistrictUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const updated = await this.prisma.district.update({ where: { id }, data });
      return this.toAdmin(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('District with this name already exists');
      }
      throw error;
    }
  }
}
