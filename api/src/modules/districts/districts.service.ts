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
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';
import { districtAuditSnapshot } from '../audit/audit.snapshots';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  async create(dto: CreateDistrictDto, adminId: string): Promise<AdminDistrict> {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.district.create({
          data: {
            name: dto.name,
            sortOrder,
            isActive: dto.isActive ?? true,
          },
        });
        await this.audit.write(
          {
            actorId: adminId,
            action: AUDIT_ACTIONS.DISTRICT_CREATED,
            entityType: AUDIT_ENTITIES.DISTRICT,
            entityId: row.id,
            afterJson: districtAuditSnapshot(row),
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
        throw new ConflictException('District with this name already exists');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateDistrictDto,
    adminId: string,
  ): Promise<AdminDistrict> {
    const existing = await this.prisma.district.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('District not found');
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

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.district.update({
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
            action: AUDIT_ACTIONS.DISTRICT_UPDATED,
            entityType: AUDIT_ENTITIES.DISTRICT,
            entityId: id,
            beforeJson: districtAuditSnapshot(existing),
            afterJson: districtAuditSnapshot(row),
          },
          tx,
        );
        return row;
      });
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
