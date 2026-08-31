import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { PublicSession, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PUBLIC_SESSION_COOKIE } from './public-auth.constants';
import { PublicAuthController } from './public-auth.controller';
import { PublicAuthService } from './public-auth.service';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { VkIdClient, type VkVerifiedProfile } from './vk-id.client';

const VALID_VK_TOKEN = 'valid-vk-access-token';
const INVALID_VK_TOKEN = 'invalid-vk-access-token';

const VK_PROFILE: VkVerifiedProfile = {
  vkId: '123456789',
  firstName: 'Иван',
  lastName: 'Иванов',
  avatarUrl: 'https://example.com/avatar.jpg',
};

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-1',
    vkId: VK_PROFILE.vkId,
    firstName: VK_PROFILE.firstName,
    lastName: VK_PROFILE.lastName,
    avatarUrl: VK_PROFILE.avatarUrl,
    isBlocked: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakePrisma {
  users: User[] = [];
  sessions: PublicSession[] = [];
  private sessionCounter = 0;

  user = {
    upsert: (args: {
      where: { vkId: string };
      create: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & Partial<User>;
      update: Partial<User>;
    }): Promise<User> => {
      const existing = this.users.find((user) => user.vkId === args.where.vkId);
      const now = new Date();
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: now });
        return Promise.resolve(existing);
      }
      const created: User = {
        id: `user-${this.users.length + 1}`,
        createdAt: now,
        updatedAt: now,
        ...args.create,
      };
      this.users.push(created);
      return Promise.resolve(created);
    },
  };

  publicSession = {
    create: (args: {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    }): Promise<PublicSession> => {
      this.sessionCounter += 1;
      const session: PublicSession = {
        id: `session-${this.sessionCounter}`,
        userId: args.data.userId,
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
      include?: { user?: boolean };
    }): Promise<(PublicSession & { user: User }) | null> => {
      const session =
        this.sessions.find((item) => item.tokenHash === args.where.tokenHash) ??
        null;
      if (!session) {
        return Promise.resolve(null);
      }
      const user = this.users.find((item) => item.id === session.userId)!;
      return Promise.resolve({ ...session, user });
    },
    updateMany: (args: {
      where: {
        id?: string;
        userId?: string;
        revokedAt?: null;
      };
      data: { revokedAt: Date };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const session of this.sessions) {
        const matchesId =
          args.where.id === undefined || session.id === args.where.id;
        const matchesUser =
          args.where.userId === undefined ||
          session.userId === args.where.userId;
        const matchesRevoked =
          args.where.revokedAt === undefined || session.revokedAt === null;
        if (matchesId && matchesUser && matchesRevoked) {
          session.revokedAt = args.data.revokedAt;
          count += 1;
        }
      }
      return Promise.resolve({ count });
    },
  };
}

class FakeVkIdClient {
  profile: VkVerifiedProfile = VK_PROFILE;

  async fetchUserProfile(accessToken: string): Promise<VkVerifiedProfile> {
    if (accessToken !== VALID_VK_TOKEN) {
      throw new (await import('@nestjs/common')).UnauthorizedException(
        'Invalid VK access token',
      );
    }
    return this.profile;
  }
}

function extractCookie(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

describe('PublicAuthController', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let vkClient: FakeVkIdClient;

  beforeEach(async () => {
    prisma = new FakePrisma();
    vkClient = new FakeVkIdClient();

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [PublicAuthController],
      providers: [
        PublicAuthService,
        PublicAuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: VkIdClient, useValue: vkClient },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('creates User on first VK login', async () => {
    const res = await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    expect(prisma.users).toHaveLength(1);
    expect(prisma.users[0].vkId).toBe(VK_PROFILE.vkId);
    expect(res.body.user.firstName).toBe(VK_PROFILE.firstName);
    expect(extractCookie(res)[0]).toMatch(`${PUBLIC_SESSION_COOKIE}=`);
  });

  it('does not create duplicate User for same vkId', async () => {
    await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    expect(prisma.users).toHaveLength(1);
  });

  it('updates profile fields on repeat login', async () => {
    await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    prisma.users[0].firstName = 'Old';
    vkClient.profile = { ...VK_PROFILE, firstName: 'Пётр' };

    const res = await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    expect(prisma.users[0].firstName).toBe('Пётр');
    expect(res.body.user.firstName).toBe('Пётр');
  });

  it('creates PublicSession and stores only token hash', async () => {
    const res = await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    expect(prisma.sessions).toHaveLength(1);
    expect(prisma.sessions[0].tokenHash).toHaveLength(64);
    expect(prisma.sessions[0].tokenHash).not.toContain('=');

    const cookie = extractCookie(res)[0];
    const rawToken = cookie.split(';')[0].split('=')[1];
    expect(hashToken(rawToken)).toBe(prisma.sessions[0].tokenHash);
    expect(prisma.sessions.some((session) => session.tokenHash === rawToken)).toBe(
      false,
    );
  });

  it('returns 401 for invalid VK token', async () => {
    await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: INVALID_VK_TOKEN })
      .expect(401);
  });

  it('returns 403 for blocked User', async () => {
    prisma.users.push(buildUser({ isBlocked: true }));

    await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(403);
  });

  it('returns authenticated session for valid cookie', async () => {
    const login = await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    const cookie = extractCookie(login)[0].split(';')[0];

    const session = await request(server())
      .get('/public/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    expect(session.body.authenticated).toBe(true);
    expect(session.body.user.firstName).toBe(VK_PROFILE.firstName);
  });

  it('returns unauthenticated for expired or revoked session', async () => {
    const login = await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    const cookie = extractCookie(login)[0].split(';')[0];
    prisma.sessions[0].expiresAt = new Date(Date.now() - 1000);

    const expired = await request(server())
      .get('/public/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    expect(expired.body.authenticated).toBe(false);

    prisma.sessions[0].expiresAt = new Date(Date.now() + 60_000);
    prisma.sessions[0].revokedAt = new Date();

    const revoked = await request(server())
      .get('/public/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    expect(revoked.body.authenticated).toBe(false);
  });

  it('logout revokes session and clears cookie', async () => {
    const login = await request(server())
      .post('/public/auth/vk')
      .send({ accessToken: VALID_VK_TOKEN })
      .expect(200);

    const cookie = extractCookie(login)[0].split(';')[0];

    const logout = await request(server())
      .post('/public/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    expect(logout.body.success).toBe(true);
    expect(prisma.sessions[0].revokedAt).not.toBeNull();
    expect(extractCookie(logout).join('')).toMatch(`${PUBLIC_SESSION_COOKIE}=;`);
  });
});
