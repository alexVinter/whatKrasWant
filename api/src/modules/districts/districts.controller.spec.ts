/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { AdminStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { AdminSession, AdminUser, District } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';
import { AuditService } from '../audit/audit.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;

function buildDistrict(overrides: Partial<District>): District {
  const now = new Date();
  return {
    id: `d-${Math.random().toString(36).slice(2)}`,
    name: 'District',
    geometry: null,
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  districts: District[] = [];
  auditLogs: Array<{
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    beforeJson: unknown;
    afterJson: unknown;
    createdAt: Date;
  }> = [];

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

  district = {
    findMany: (): Promise<District[]> =>
      Promise.resolve(
        [...this.districts].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      ),
    aggregate: (): Promise<{ _max: { sortOrder: number | null } }> => {
      const max = this.districts.reduce(
        (acc, d) => (d.sortOrder > acc ? d.sortOrder : acc),
        0,
      );
      return Promise.resolve({
        _max: { sortOrder: this.districts.length ? max : null },
      });
    },
    create: (args: {
      data: { name: string; sortOrder: number; isActive: boolean };
    }): Promise<District> => {
      if (this.districts.some((d) => d.name === args.data.name)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      const created = buildDistrict(args.data);
      this.districts.push(created);
      return Promise.resolve(created);
    },
    findUnique: (args: { where: { id: string } }): Promise<District | null> =>
      Promise.resolve(this.districts.find((d) => d.id === args.where.id) ?? null),
    update: (args: {
      where: { id: string };
      data: Partial<District>;
    }): Promise<District> => {
      const district = this.districts.find((d) => d.id === args.where.id)!;
      Object.assign(district, args.data, { updatedAt: new Date() });
      return Promise.resolve(district);
    },
  };

  adminAuditLog = {
    create: (args: { data: Record<string, any> }) => {
      const row = {
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
}

describe('DistrictsController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    const now = new Date();
    prisma.admins.push({
      id: 'admin-1',
      login: 'admin',
      email: 'admin@example.com',
      passwordHash: 'hashed:x',
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
    prisma.districts.push(
      buildDistrict({ id: 'd1', name: 'Центральный', sortOrder: 2 }),
      buildDistrict({ id: 'd2', name: 'Железнодорожный', sortOrder: 1 }),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [DistrictsController],
      providers: [
        DistrictsService,
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

  it('rejects GET /admin/districts without a session (401)', async () => {
    await request(server()).get('/admin/districts').expect(401);
  });

  it('returns districts for an authenticated admin (200), sorted', async () => {
    const res = await request(server())
      .get('/admin/districts')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body.map((d: { name: string }) => d.name)).toEqual([
      'Железнодорожный',
      'Центральный',
    ]);
    expect(res.body[0]).not.toHaveProperty('geometry');
  });

  it('creates a district (201)', async () => {
    const res = await request(server())
      .post('/admin/districts')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Новый район' })
      .expect(201);

    expect(res.body.name).toBe('Новый район');
    expect(res.body.sortOrder).toBe(3);
    expect(res.body.isActive).toBe(true);
  });

  it('updates a district name via PATCH', async () => {
    const res = await request(server())
      .patch('/admin/districts/d1')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Центр' })
      .expect(200);

    expect(res.body.name).toBe('Центр');
  });

  it('toggles a district active state via PATCH', async () => {
    const res = await request(server())
      .patch('/admin/districts/d1')
      .set('Cookie', AUTH_COOKIE)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('returns 404 for an unknown district', async () => {
    await request(server())
      .patch('/admin/districts/does-not-exist')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'X' })
      .expect(404);
  });

  it('writes district audit records', async () => {
    const created = await request(server())
      .post('/admin/districts')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'TEST E08 DISTRICT' })
      .expect(201);

    expect(prisma.auditLogs.map((row) => row.action)).toEqual([
      'DISTRICT_CREATED',
    ]);
    expect(prisma.auditLogs[0].actorId).toBe('admin-1');

    await request(server())
      .patch(`/admin/districts/${created.body.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'TEST E08 DISTRICT renamed' })
      .expect(200);

    expect(prisma.auditLogs.map((row) => row.action)).toEqual([
      'DISTRICT_CREATED',
      'DISTRICT_UPDATED',
    ]);
  });
});
