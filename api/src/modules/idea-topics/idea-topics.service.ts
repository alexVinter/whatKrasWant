import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AdminIdeaTopic {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class IdeaTopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveForAdmin(): Promise<AdminIdeaTopic[]> {
    const rows = await this.prisma.ideaTopic.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true },
    });
    return rows;
  }
}
