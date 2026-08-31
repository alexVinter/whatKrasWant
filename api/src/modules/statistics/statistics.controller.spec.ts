/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  AdminStatus,
  IdeaSourceType,
  IdeaStatus,
  TerritoryType,
} from '@prisma/client';
import type {
  AdminSession,
  AdminUser,
  District,
  Idea,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsXlsxService } from './xlsx.service';
import { XLSX_CONTENT_TYPE, XLSX_SHEETS } from './statistics.labels';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;
const SECRET_HASH = 'SECRET_PASSWORD_HASH_E10';
const SECRET_TOKEN = 'SECRET_TOKEN_HASH_E10';

interface IdeaDistrictRow {
  ideaId: string;
  districtId: string;
}

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  districts: District[] = [];
  ideas: Idea[] = [];
  ideaDistricts: IdeaDistrictRow[] = [];

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

  private matches(idea: Idea, where?: Record<string, any>): boolean {
    if (!where) return true;
    if (where.sourceType && idea.sourceType !== where.sourceType) return false;
    if (where.status && idea.status !== where.status) return false;
    if (where.territoryType && idea.territoryType !== where.territoryType) {
      return false;
    }
    if (where.latitude?.not === null && idea.latitude === null) return false;
    if (where.longitude?.not === null && idea.longitude === null) return false;
    return true;
  }

  private groupBy(
    rows: Record<string, any>[],
    by: string[],
  ): Promise<{ [key: string]: unknown; _count: { _all: number } }[]> {
    const map = new Map<string, { key: Record<string, unknown>; count: number }>();
    for (const row of rows) {
      const keyObj: Record<string, unknown> = {};
      for (const field of by) {
        keyObj[field] = row[field];
      }
      const key = JSON.stringify(keyObj);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key: keyObj, count: 1 });
      }
    }
    return Promise.resolve(
      [...map.values()].map((group) => ({
        ...group.key,
        _count: { _all: group.count },
      })),
    );
  }

  idea = {
    count: (args?: { where?: Record<string, any> }): Promise<number> =>
      Promise.resolve(
        this.ideas.filter((idea) => this.matches(idea, args?.where)).length,
      ),
    groupBy: (args: {
      by: string[];
      _count: { _all: true };
      where?: Record<string, any>;
    }) =>
      this.groupBy(
        this.ideas.filter((idea) => this.matches(idea, args.where)),
        args.by,
      ),
    findMany: (): Promise<any[]> => {
      const rows = [...this.ideas].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      return Promise.resolve(
        rows.map((idea) => ({
          title: idea.title,
          sourceType: idea.sourceType,
          expertName: idea.expertName,
          expertOrg: idea.expertOrg,
          status: idea.status,
          territoryType: idea.territoryType,
          address: idea.address,
          latitude: idea.latitude,
          longitude: idea.longitude,
          createdAt: idea.createdAt,
          publishedAt: idea.publishedAt,
          topic: null,
          districts: this.ideaDistricts
            .filter((row) => row.ideaId === idea.id)
            .map((row) => ({
              district: {
                name: this.districts.find((d) => d.id === row.districtId)!.name,
              },
            })),
        })),
      );
    },
  };

  ideaDistrict = {
    groupBy: (args: { by: string[]; _count: { _all: true } }) =>
      this.groupBy(this.ideaDistricts, args.by),
  };

  district = {
    findMany: (): Promise<{ id: string; name: string }[]> =>
      Promise.resolve(this.districts.map((d) => ({ id: d.id, name: d.name }))),
  };
}

function buildIdea(overrides: Partial<Idea> & { id: string; title: string }): Idea {
  const now = new Date('2026-08-17T10:00:00.000Z');
  return {
    publicNumber: 1,
    slug: overrides.id,
    sourceType: IdeaSourceType.EXPERT,
    expertName: 'TEST E10 Expert',
    expertOrg: 'TEST E10 Org',
    description: 'desc',
    topicId: null,
    userId: null,
    territoryType: TerritoryType.CITYWIDE,
    address: null,
    latitude: null,
    longitude: null,
    status: IdeaStatus.DRAFT,
    isTop20: false,
    submittedAt: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('StatisticsController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    const now = new Date();
    prisma.admins.push({
      id: 'admin-1',
      login: 'admin',
      email: 'admin@example.com',
      passwordHash: SECRET_HASH,
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
      {
        id: 'd1',
        name: 'Советский',
        geometry: null,
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'd2',
        name: 'Центральный',
        geometry: null,
        sortOrder: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    );
    prisma.ideas.push(
      buildIdea({
        id: 'draft-1',
        title: 'TEST E10 DRAFT',
        status: IdeaStatus.DRAFT,
        territoryType: TerritoryType.CITYWIDE,
      }),
      buildIdea({
        id: 'published-1',
        title: 'TEST E10 PUBLISHED',
        status: IdeaStatus.PUBLISHED,
        territoryType: TerritoryType.DISTRICTS,
        latitude: 56.01,
        longitude: 92.87,
        publishedAt: new Date('2026-08-10T12:00:00.000Z'),
      }),
      buildIdea({
        id: 'archived-1',
        title: 'TEST E10 ARCHIVED',
        status: IdeaStatus.ARCHIVED,
        territoryType: TerritoryType.DISTRICTS,
      }),
    );
    prisma.ideaDistricts.push(
      { ideaId: 'published-1', districtId: 'd1' },
      { ideaId: 'archived-1', districtId: 'd1' },
      { ideaId: 'archived-1', districtId: 'd2' },
    );

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [StatisticsController],
      providers: [
        StatisticsService,
        StatisticsXlsxService,
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

  async function downloadWorkbook() {
    const res = await request(server())
      .get('/admin/statistics/xlsx')
      .set('Cookie', AUTH_COOKIE)
      .buffer(true)
      .parse((incoming, callback) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        incoming.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body as unknown as ArrayBuffer);
    return { res, workbook };
  }

  it('rejects GET /admin/statistics without a session (401)', async () => {
    await request(server()).get('/admin/statistics').expect(401);
  });

  it('returns statistics for an authenticated admin (200)', async () => {
    const res = await request(server())
      .get('/admin/statistics')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.expertInitiatives).toBeDefined();
  });

  it('counts expert, draft, published, archived and located ideas', async () => {
    const res = await request(server())
      .get('/admin/statistics')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body.expertInitiatives).toBe(3);
    expect(res.body.draft).toBe(1);
    expect(res.body.published).toBe(1);
    expect(res.body.archived).toBe(1);
    expect(res.body.withLocation).toBe(1);
  });

  it('counts CITYWIDE as Весь город and multi-district ideas in each district', async () => {
    const res = await request(server())
      .get('/admin/statistics')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    const byName = Object.fromEntries(
      res.body.byTerritory.map((row: { name: string; count: number }) => [
        row.name,
        row.count,
      ]),
    );
    expect(byName['Советский']).toBe(2);
    expect(byName['Весь город']).toBe(1);
    expect(byName['Центральный']).toBe(1);
  });

  it('rejects XLSX download without a session (401)', async () => {
    await request(server()).get('/admin/statistics/xlsx').expect(401);
  });

  it('returns a real XLSX workbook with the required sheets', async () => {
    const { res, workbook } = await downloadWorkbook();
    expect(res.headers['content-type']).toContain(XLSX_CONTENT_TYPE);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="initiatives_\d{4}-\d{2}-\d{2}\.xlsx"/,
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      XLSX_SHEETS.INITIATIVES,
      XLSX_SHEETS.AUTHORS,
      XLSX_SHEETS.VOTES,
      XLSX_SHEETS.STATISTICS,
      XLSX_SHEETS.TOP20,
    ]);
  });

  it('includes Release 1 ideas and experts with human-readable values and date cells', async () => {
    const { workbook } = await downloadWorkbook();
    const initiatives = workbook.getWorksheet(XLSX_SHEETS.INITIATIVES)!;
    const titles = initiatives
      .getColumn(1)
      .values.filter((value) => typeof value === 'string') as string[];
    expect(titles).toEqual(
      expect.arrayContaining([
        'Название',
        'TEST E10 DRAFT',
        'TEST E10 PUBLISHED',
        'TEST E10 ARCHIVED',
      ]),
    );

    const draftRow = [...initiatives.getRows(2, initiatives.rowCount - 1)!].find(
      (row) => row.getCell(1).value === 'TEST E10 DRAFT',
    )!;
    expect(draftRow.getCell(2).value).toBe('Эксперт');
    expect(draftRow.getCell(5).value).toBe('Черновик');
    expect(draftRow.getCell(6).value).toBe('');
    expect(draftRow.getCell(7).value).toBe('Весь город');
    expect(draftRow.getCell(12).value).toBeInstanceOf(Date);
    expect(draftRow.getCell(12).numFmt).toBe('dd.mm.yyyy hh:mm');
    expect(draftRow.getCell(13).value).toBe('');

    const authors = workbook.getWorksheet(XLSX_SHEETS.AUTHORS)!;
    const authorText = JSON.stringify(authors.getSheetValues());
    expect(authorText).toContain('TEST E10 DRAFT');
    expect(authorText).toContain('TEST E10 Expert');
    expect(authorText).toContain('Эксперт');
  });

  it('keeps Votes and Top-20 informational without fake business rows', async () => {
    const { workbook } = await downloadWorkbook();
    const votes = JSON.stringify(
      workbook.getWorksheet(XLSX_SHEETS.VOTES)!.getSheetValues(),
    );
    const top20 = JSON.stringify(
      workbook.getWorksheet(XLSX_SHEETS.TOP20)!.getSheetValues(),
    );
    expect(votes).toContain('Данные о голосах появятся в Релизе 2.');
    expect(top20).toContain(
      'Данные топ-20 появятся на соответствующем этапе.',
    );
    expect(votes).not.toContain('TEST E10 DRAFT');
    expect(top20).not.toContain('TEST E10 DRAFT');
    expect(votes.toLowerCase()).not.toContain('vk');
  });

  it('writes real aggregates into the statistics sheet', async () => {
    const { workbook } = await downloadWorkbook();
    const stats = JSON.stringify(
      workbook.getWorksheet(XLSX_SHEETS.STATISTICS)!.getSheetValues(),
    );
    expect(stats).toContain('Экспертные инициативы');
    expect(stats).toContain('С геометкой');
    expect(stats).toContain('Весь город');
    expect(stats).toContain('Советский');
  });

  it('does not leak secrets into the workbook', async () => {
    const { workbook } = await downloadWorkbook();
    const dumped = workbook.worksheets
      .map((sheet) => JSON.stringify(sheet.getSheetValues()))
      .join('\n');
    expect(dumped).not.toContain(SECRET_HASH);
    expect(dumped).not.toContain(SECRET_TOKEN);
    expect(dumped).not.toContain('passwordHash');
    expect(dumped).not.toContain('tokenHash');
    expect(dumped).not.toContain('S3_SECRET');
    expect(dumped).not.toContain('MINIO');
    expect(dumped).not.toContain('ADMIN_BOOTSTRAP_PASSWORD');
    expect(dumped).not.toContain('beforeJson');
    expect(dumped).not.toContain('afterJson');
  });
});
