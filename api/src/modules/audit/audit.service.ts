import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_AUDIT_PAGE,
  DEFAULT_AUDIT_PAGE_SIZE,
  type AuditAction,
  type AuditEntityType,
} from './audit.constants';
import { objectLabelFromSnapshot } from './audit.snapshots';
import { ListAuditDto } from './dto/list-audit.dto';

export type AuditDb = Prisma.TransactionClient | PrismaService;

export interface AuditWrite {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditWrite, db: AuditDb = this.prisma): Promise<void> {
    await db.adminAuditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeJson: entry.beforeJson ?? undefined,
        afterJson: entry.afterJson ?? undefined,
      },
    });
  }

  async list(query: ListAuditDto) {
    const page = query.page ?? DEFAULT_AUDIT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, login: true } },
        },
      }),
      this.prisma.adminAuditLog.count(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actor: row.actor
          ? { id: row.actor.id, login: row.actor.login }
          : null,
        objectLabel: objectLabelFromSnapshot(
          row.entityType,
          row.afterJson ?? row.beforeJson,
        ),
      })),
      page,
      pageSize,
      total,
    };
  }
}
