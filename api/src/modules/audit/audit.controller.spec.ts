/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { AdminStatus } from '@prisma/client';
import type { AdminSession, AdminUser } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
}

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  auditLogs: AuditRow[] = [];

  $transaction = (arg: unknown): Promise<unknown> => {
    if (typeof arg === 'function') {
      return (arg as (tx: FakePrisma) => Promise<unknown>)(this);
    }
    return Promise.all(arg as Promise<unknown>[]);
  };

  adminSession = {
    findUnique: (args: {
      where: { tokenHash: string };
    }): Promise<(AdminSession & { adminUser: AdminUser }) | null> => {
      const session =
        this.sessions.find((s) => s.tokenHash === args.where.tokenHash) ?? null;
      if (!session) return Promise.resolve(null);
      const adminUser = this.admins.find((a) => a.id === session.adminUserId)!;
      return Promise.resolve({ ...session, adminUser });
    },
  };

  adminAuditLog = {
    findMany: (args: {
      orderBy?: { createdAt?: 'desc' | 'asc' };
      skip?: number;
      take?: number;
      include?: { actor?: unknown };
    }) => {
      let rows = [...this.auditLogs].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      if (args.skip) rows = rows.slice(args.skip);
      if (args.take !== undefined) rows = rows.slice(0, args.take);
      return Promise.resolve(
        rows.map((row) => {
          const actor = this.admins.find((a) => a.id === row.actorId);
          return {
            ...row,
            actor:
              args.include?.actor && actor
                ? { id: actor.id, login: actor.login }
                : null,
          };
        }),
      );
    },
    count: (): Promise<number> => Promise.resolve(this.auditLogs.length),
    create: (args: { data: Record<string, any> }) => {
      const row: AuditRow = {
        id: `audit-${this.auditLogs.length + 1}`,
        actorId: args.data.actorId ?? null,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId ?? null,
        beforeJson: args.data.beforeJson ?? null,
        afterJson: args.data.afterJson ?? null,
        createdAt: new Date(Date.now() + this.auditLogs.length * 1000),
      };
      this.auditLogs.push(row);
      return Promise.resolve(row);
    },
  };
}

describe('AuditController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    const now = new Date();
    prisma.admins.push({
      id: 'admin-1',
      login: 'admin',
      email: 'admin@example.com',
      passwordHash: 'hashed:secret-password',
      status: AdminStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.sessions.push({
      id: 'session-1',
      adminUserId: 'admin-1',
      tokenHash: createHash('sha256').update(RAW_TOKEN).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      revokedAt: null,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [AuditController],
      providers: [
        AuditService,
        AdminAuthService,
        AdminAuthGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  const seed = (
    overrides: Partial<AuditRow> & { afterJson?: unknown; createdAt?: Date },
  ) => {
    prisma.auditLogs.push({
      id: overrides.id ?? `seed-${prisma.auditLogs.length + 1}`,
      actorId: overrides.actorId ?? 'admin-1',
      action: overrides.action ?? 'IDEA_CREATED',
      entityType: overrides.entityType ?? 'IDEA',
      entityId: overrides.entityId ?? 'idea-1',
      beforeJson: overrides.beforeJson ?? null,
      afterJson: overrides.afterJson ?? { title: 'Инициатива' },
      createdAt: overrides.createdAt ?? new Date(),
    });
  };

  it('rejects GET /admin/audit without a session (401)', async () => {
    await request(server()).get('/admin/audit').expect(401);
  });

  it('returns an empty list for an authenticated admin (200)', async () => {
    const res = await request(server())
      .get('/admin/audit')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body).toEqual({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
  });

  it('returns newest first without beforeJson, afterJson or secrets', async () => {
    seed({
      id: 'old',
      action: 'IDEA_CREATED',
      afterJson: { title: 'Старое название' },
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    seed({
      id: 'new',
      action: 'IDEA_UPDATED',
      afterJson: { title: 'Новое название' },
      createdAt: new Date('2026-08-17T10:00:00.000Z'),
    });

    const res = await request(server())
      .get('/admin/audit')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([
      'new',
      'old',
    ]);
    expect(res.body.items[0].actor).toEqual({ id: 'admin-1', login: 'admin' });
    expect(res.body.items[0].objectLabel).toBe('Новое название');
    expect(res.body.items[1].objectLabel).toBe('Старое название');
    expect(res.body.items[0]).not.toHaveProperty('beforeJson');
    expect(res.body.items[0]).not.toHaveProperty('afterJson');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('hashed:secret-password');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
  });

  it('keeps a historical objectLabel after a later rename snapshot', async () => {
    seed({
      id: 'created',
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      afterJson: { name: 'Старое имя категории' },
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    seed({
      id: 'renamed',
      action: 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      beforeJson: { name: 'Старое имя категории' },
      afterJson: { name: 'Новое имя категории' },
      createdAt: new Date('2026-08-17T10:00:00.000Z'),
    });

    const res = await request(server())
      .get('/admin/audit')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    const created = res.body.items.find((item: { id: string }) => item.id === 'created');
    expect(created.objectLabel).toBe('Старое имя категории');
  });

  it('returns a human object label for SETTINGS_UPDATED', async () => {
    seed({
      id: 'settings-1',
      action: 'SETTINGS_UPDATED',
      entityType: 'SETTINGS',
      entityId: 'publicity',
      beforeJson: {
        PUBLIC_CATALOG: false,
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      },
      afterJson: {
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      },
    });

    const res = await request(server())
      .get('/admin/audit')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body.items[0].objectLabel).toBe('Настройки публичности');
    expect(res.body.items[0].action).toBe('SETTINGS_UPDATED');
  });

  it('paginates with a max pageSize of 100', async () => {
    seed({
      id: 'a',
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      afterJson: { title: 'A' },
    });
    seed({
      id: 'b',
      createdAt: new Date('2026-08-02T10:00:00.000Z'),
      afterJson: { title: 'B' },
    });
    seed({
      id: 'c',
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      afterJson: { title: 'C' },
    });

    const page1 = await request(server())
      .get('/admin/audit?page=1&pageSize=2')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(page1.body.items.map((item: { id: string }) => item.id)).toEqual([
      'c',
      'b',
    ]);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageSize).toBe(2);
    expect(page1.body.total).toBe(3);

    const page2 = await request(server())
      .get('/admin/audit?page=2&pageSize=2')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(page2.body.items.map((item: { id: string }) => item.id)).toEqual([
      'a',
    ]);

    await request(server())
      .get('/admin/audit?pageSize=101')
      .set('Cookie', AUTH_COOKIE)
      .expect(400);
  });
});
