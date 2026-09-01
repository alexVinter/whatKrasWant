/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { AdminStatus } from '@prisma/client';
import type { AdminSession, AdminUser, SystemSetting } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { AuditService } from '../audit/audit.service';
import { PublicConfigController } from '../public-config/public-config.controller';
import { PublicConfigService } from '../public-config/public-config.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;

const ALL_FALSE = {
  PUBLIC_CATALOG: false,
  PUBLIC_SUBMISSION: false,
  VOTING: false,
  RESULTS: false,
};

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
  settings: SystemSetting[] = [];
  auditLogs: AuditRow[] = [];
  failOnKey: string | null = null;
  writeCount = 0;

  $transaction = async (arg: unknown): Promise<unknown> => {
    if (typeof arg === 'function') {
      const settingsSnapshot = this.settings.map((row) => ({ ...row }));
      const auditSnapshot = this.auditLogs.map((row) => ({ ...row }));
      try {
        return await (arg as (tx: FakePrisma) => Promise<unknown>)(this);
      } catch (error) {
        this.settings = settingsSnapshot;
        this.auditLogs = auditSnapshot;
        throw error;
      }
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

  systemSetting = {
    findMany: (args?: {
      where?: { key?: { in?: string[] } };
    }): Promise<SystemSetting[]> => {
      const keys = args?.where?.key?.in;
      const filtered = keys
        ? this.settings.filter((row) => keys.includes(row.key))
        : this.settings;
      return Promise.resolve(filtered);
    },
    upsert: (args: {
      where: { key: string };
      create: {
        key: string;
        value: boolean;
        updatedBy: string | null;
      };
      update: { value: boolean; updatedBy: string | null };
    }): Promise<SystemSetting> => {
      this.writeCount += 1;
      if (this.failOnKey && args.where.key === this.failOnKey) {
        throw new Error('forced upsert failure');
      }
      const existing = this.settings.find((row) => row.key === args.where.key);
      if (existing) {
        existing.value = args.update.value;
        existing.updatedBy = args.update.updatedBy;
        existing.updatedAt = new Date();
        return Promise.resolve(existing);
      }
      const created: SystemSetting = {
        key: args.create.key,
        value: args.create.value,
        updatedBy: args.create.updatedBy,
        updatedAt: new Date(),
      };
      this.settings.push(created);
      return Promise.resolve(created);
    },
  };

  adminAuditLog = {
    create: (args: { data: Record<string, any> }) => {
      this.writeCount += 1;
      const row: AuditRow = {
        id: `audit-${this.auditLogs.length + 1}`,
        actorId: args.data.actorId ?? null,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId ?? null,
        beforeJson: args.data.beforeJson ?? null,
        afterJson: args.data.afterJson ?? null,
        createdAt: new Date(),
      };
      this.auditLogs.push(row);
      return Promise.resolve(row);
    },
  };

  district = {
    findMany: (): Promise<never[]> => Promise.resolve([]),
  };

  idea = {
    count: (): Promise<number> => Promise.resolve(0),
  };
}

describe('SettingsController (e2e)', () => {
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
    prisma.settings.push(
      { key: 'PUBLIC_CATALOG', value: false, updatedBy: null, updatedAt: now },
      { key: 'PUBLIC_SUBMISSION', value: false, updatedBy: null, updatedAt: now },
      { key: 'VOTING', value: false, updatedBy: null, updatedAt: now },
      { key: 'RESULTS', value: false, updatedBy: null, updatedAt: now },
    );

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [SettingsController, PublicConfigController],
      providers: [
        SettingsService,
        PublicConfigService,
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

  it('rejects GET /admin/settings without a session (401)', async () => {
    await request(server()).get('/admin/settings').expect(401);
  });

  it('returns settings for an authenticated admin (200)', async () => {
    const res = await request(server())
      .get('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body).toEqual(ALL_FALSE);
  });

  it('returns exactly four feature flag keys', async () => {
    const res = await request(server())
      .get('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(
      ['PUBLIC_CATALOG', 'PUBLIC_SUBMISSION', 'RESULTS', 'VOTING'].sort(),
    );
  });

  it('returns false for a missing DB setting and does not write on GET', async () => {
    prisma.settings = prisma.settings.filter((row) => row.key !== 'VOTING');
    const writesBefore = prisma.writeCount;

    const res = await request(server())
      .get('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body.VOTING).toBe(false);
    expect(prisma.settings.some((row) => row.key === 'VOTING')).toBe(false);
    expect(prisma.writeCount).toBe(writesBefore);
  });

  it('rejects PATCH /admin/settings without a session (401)', async () => {
    await request(server()).patch('/admin/settings').send(ALL_FALSE).expect(401);
  });

  it('saves all four booleans via PATCH', async () => {
    const payload = {
      PUBLIC_CATALOG: true,
      PUBLIC_SUBMISSION: true,
      VOTING: false,
      RESULTS: true,
    };

    const res = await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(
      prisma.settings.find((row) => row.key === 'PUBLIC_CATALOG')?.value,
    ).toBe(true);
    expect(
      prisma.settings.find((row) => row.key === 'PUBLIC_SUBMISSION')?.value,
    ).toBe(true);
    expect(prisma.settings.find((row) => row.key === 'VOTING')?.value).toBe(
      false,
    );
    expect(prisma.settings.find((row) => row.key === 'RESULTS')?.value).toBe(
      true,
    );
  });

  it('rejects a string instead of a boolean with 400', async () => {
    await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send({
        PUBLIC_CATALOG: 'true',
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      })
      .expect(400);
  });

  it('rejects an unknown key with 400', async () => {
    await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send({
        ...ALL_FALSE,
        RATING: true,
      })
      .expect(400);
  });

  it('rolls back PATCH atomically when a write fails', async () => {
    prisma.failOnKey = 'RESULTS';

    await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send({
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: true,
        VOTING: true,
        RESULTS: true,
      })
      .expect(500);

    expect(
      prisma.settings.find((row) => row.key === 'PUBLIC_CATALOG')?.value,
    ).toBe(false);
    expect(
      prisma.settings.find((row) => row.key === 'PUBLIC_SUBMISSION')?.value,
    ).toBe(false);
    expect(prisma.auditLogs).toHaveLength(0);
  });

  it('persists values so a later GET returns them', async () => {
    await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send({
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: true,
        RESULTS: false,
      })
      .expect(200);

    const res = await request(server())
      .get('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body).toEqual({
      PUBLIC_CATALOG: true,
      PUBLIC_SUBMISSION: false,
      VOTING: true,
      RESULTS: false,
    });
  });

  it('reflects saved flags in GET /public/config', async () => {
    await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send({
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      })
      .expect(200);

    const res = await request(server()).get('/public/config').expect(200);
    expect(res.body.features).toEqual({
      PUBLIC_CATALOG: true,
      PUBLIC_SUBMISSION: false,
      VOTING: false,
      RESULTS: false,
    });
  });

  it('writes SETTINGS_UPDATED audit with actor, before and after', async () => {
    await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send({
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      })
      .expect(200);

    expect(prisma.auditLogs).toHaveLength(1);
    expect(prisma.auditLogs[0]).toMatchObject({
      actorId: 'admin-1',
      action: 'SETTINGS_UPDATED',
      entityType: 'SETTINGS',
      beforeJson: ALL_FALSE,
      afterJson: {
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      },
    });
  });

  it('does not write audit on a no-op PATCH', async () => {
    const res = await request(server())
      .patch('/admin/settings')
      .set('Cookie', AUTH_COOKIE)
      .send(ALL_FALSE)
      .expect(200);

    expect(res.body).toEqual(ALL_FALSE);
    expect(prisma.auditLogs).toHaveLength(0);
    expect(prisma.writeCount).toBe(0);
  });
});
