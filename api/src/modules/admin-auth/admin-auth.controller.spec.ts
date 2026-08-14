import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AdminStatus } from '@prisma/client';
import type { AdminSession, AdminUser } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn((hashString: string, value: string) =>
    Promise.resolve(hashString === `hashed:${value}`),
  ),
}));

const CORRECT_PASSWORD = 'correct-password';

function buildAdmin(overrides: Partial<AdminUser>): AdminUser {
  const now = new Date();
  return {
    id: 'admin-1',
    login: 'admin',
    email: 'admin@example.com',
    passwordHash: `hashed:${CORRECT_PASSWORD}`,
    status: AdminStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  private sessionCounter = 0;

  adminUser = {
    findUnique: (args: {
      where: { login?: string; id?: string };
    }): Promise<AdminUser | null> => {
      const { where } = args;
      const found =
        this.admins.find(
          (a) =>
            (where.login !== undefined && a.login === where.login) ||
            (where.id !== undefined && a.id === where.id),
        ) ?? null;
      return Promise.resolve(found);
    },
    update: (args: {
      where: { id: string };
      data: Partial<AdminUser>;
    }): Promise<AdminUser> => {
      const admin = this.admins.find((a) => a.id === args.where.id)!;
      Object.assign(admin, args.data);
      return Promise.resolve(admin);
    },
  };

  adminSession = {
    create: (args: {
      data: { adminUserId: string; tokenHash: string; expiresAt: Date };
    }): Promise<AdminSession> => {
      this.sessionCounter += 1;
      const session: AdminSession = {
        id: `session-${this.sessionCounter}`,
        adminUserId: args.data.adminUserId,
        tokenHash: args.data.tokenHash,
        expiresAt: args.data.expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      };
      this.sessions.push(session);
      return Promise.resolve(session);
    },
    findUnique: (args: {
      where: { tokenHash: string };
      include?: { adminUser?: boolean };
    }): Promise<(AdminSession & { adminUser: AdminUser }) | null> => {
      const session =
        this.sessions.find((s) => s.tokenHash === args.where.tokenHash) ?? null;
      if (!session) {
        return Promise.resolve(null);
      }
      const adminUser = this.admins.find(
        (a) => a.id === session.adminUserId,
      )!;
      return Promise.resolve({ ...session, adminUser });
    },
    updateMany: (args: {
      where: { id?: string; adminUserId?: string; revokedAt?: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const session of this.sessions) {
        const matchesId =
          args.where.id === undefined || session.id === args.where.id;
        const matchesAdmin =
          args.where.adminUserId === undefined ||
          session.adminUserId === args.where.adminUserId;
        const matchesRevoked =
          args.where.revokedAt === undefined || session.revokedAt === null;
        if (matchesId && matchesAdmin && matchesRevoked) {
          session.revokedAt = args.data.revokedAt;
          count += 1;
        }
      }
      return Promise.resolve({ count });
    },
  };
}

function extractCookie(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

describe('AdminAuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    prisma.admins.push(
      buildAdmin({ id: 'admin-1', login: 'admin' }),
      buildAdmin({
        id: 'admin-2',
        login: 'blocked',
        email: 'blocked@example.com',
        status: AdminStatus.DISABLED,
      }),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [AdminAuthController],
      providers: [
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

  it('logs in with correct credentials (200, cookie set, no passwordHash)', async () => {
    const res = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: CORRECT_PASSWORD })
      .expect(200);

    expect(res.body.admin).toEqual({
      id: 'admin-1',
      login: 'admin',
      email: 'admin@example.com',
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');

    const cookies = extractCookie(res);
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies[0]).toContain('wkw_admin_session=');
    expect(cookies[0].toLowerCase()).toContain('httponly');
  });

  it('rejects a wrong password with 401', async () => {
    await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects an unknown login with the same 401 as a wrong password', async () => {
    const unknown = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'does-not-exist', password: CORRECT_PASSWORD })
      .expect(401);

    const wrongPassword = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: 'wrong-password' })
      .expect(401);

    expect(unknown.body).toEqual(wrongPassword.body);
  });

  it('rejects GET /session without a cookie (401)', async () => {
    await request(server()).get('/admin/auth/session').expect(401);
  });

  it('returns the admin for GET /session with a valid cookie (200)', async () => {
    const login = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: CORRECT_PASSWORD })
      .expect(200);

    const res = await request(server())
      .get('/admin/auth/session')
      .set('Cookie', extractCookie(login))
      .expect(200);

    expect(res.body.admin.login).toBe('admin');
  });

  it('invalidates the current session after logout', async () => {
    const login = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: CORRECT_PASSWORD })
      .expect(200);
    const cookie = extractCookie(login);

    await request(server())
      .post('/admin/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    await request(server())
      .get('/admin/auth/session')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('invalidates all sessions after logout-all', async () => {
    const first = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: CORRECT_PASSWORD })
      .expect(200);
    const second = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: CORRECT_PASSWORD })
      .expect(200);

    const firstCookie = extractCookie(first);
    const secondCookie = extractCookie(second);

    await request(server())
      .post('/admin/auth/logout-all')
      .set('Cookie', firstCookie)
      .expect(200);

    await request(server())
      .get('/admin/auth/session')
      .set('Cookie', firstCookie)
      .expect(401);
    await request(server())
      .get('/admin/auth/session')
      .set('Cookie', secondCookie)
      .expect(401);
  });

  it('forbids login for a disabled admin and rejects its existing session', async () => {
    // Disabled admin cannot log in.
    await request(server())
      .post('/admin/auth/login')
      .send({ login: 'blocked', password: CORRECT_PASSWORD })
      .expect(401);

    // An active admin logs in, then gets disabled: the existing session must fail the guard.
    const login = await request(server())
      .post('/admin/auth/login')
      .send({ login: 'admin', password: CORRECT_PASSWORD })
      .expect(200);
    const cookie = extractCookie(login);

    await request(server())
      .get('/admin/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    prisma.admins[0].status = AdminStatus.DISABLED;

    await request(server())
      .get('/admin/auth/session')
      .set('Cookie', cookie)
      .expect(401);
  });
});
