import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { District, SystemSetting } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PublicConfigController } from './public-config.controller';
import { PublicConfigService } from './public-config.service';

function buildDistrict(overrides: Partial<District>): District {
  const now = new Date();
  return {
    id: `d-${Math.random().toString(36).slice(2)}`,
    name: 'District',
    geometry: { type: 'Polygon' },
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakePrisma {
  districts: District[] = [];
  settings: SystemSetting[] = [];

  district = {
    findMany: (args: {
      where?: { isActive?: boolean };
    }): Promise<District[]> => {
      const filtered = this.districts.filter(
        (d) => args.where?.isActive === undefined || d.isActive === args.where.isActive,
      );
      return Promise.resolve(
        filtered.sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      );
    },
  };

  systemSetting = {
    findMany: (args: {
      where?: { key?: { in?: string[] } };
    }): Promise<SystemSetting[]> => {
      const keys = args.where?.key?.in;
      const filtered = keys
        ? this.settings.filter((s) => keys.includes(s.key))
        : this.settings;
      return Promise.resolve(filtered);
    },
  };

  idea = {
    count: (args: {
      where?: { status?: string };
    }): Promise<number> => {
      let rows = [...this.ideas];
      if (args.where?.status) {
        rows = rows.filter((row) => row.status === args.where!.status);
      }
      return Promise.resolve(rows.length);
    },
  };

  ideas: import('@prisma/client').Idea[] = [];
}

describe('PublicConfigController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    prisma.districts.push(
      buildDistrict({ name: 'Активный', sortOrder: 1, isActive: true }),
      buildDistrict({ name: 'Отключённый', sortOrder: 2, isActive: false }),
    );
    // Only two flags stored; the other two are absent and must default to false.
    prisma.settings.push(
      { key: 'PUBLIC_CATALOG', value: true, updatedBy: null, updatedAt: new Date() },
      { key: 'VOTING', value: false, updatedBy: null, updatedAt: new Date() },
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicConfigController],
      providers: [
        PublicConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('returns the public config without authentication (200)', async () => {
    await request(server()).get('/public/config').expect(200);
  });

  it('excludes inactive districts', async () => {
    const res = await request(server()).get('/public/config').expect(200);

    const districtNames = res.body.districts.map((d: { name: string }) => d.name);
    expect(districtNames).toEqual(['Активный']);
    expect(districtNames).not.toContain('Отключённый');
  });

  it('does not expose district geometry', async () => {
    const res = await request(server()).get('/public/config').expect(200);

    expect(Object.keys(res.body.districts[0]).sort()).toEqual(['id', 'name']);
  });

  it('returns exactly the four feature flags, defaulting missing ones to false', async () => {
    const res = await request(server()).get('/public/config').expect(200);

    expect(Object.keys(res.body.features).sort()).toEqual([
      'PUBLIC_CATALOG',
      'PUBLIC_SUBMISSION',
      'RESULTS',
      'VOTING',
    ].sort());
    expect(res.body.features).toEqual({
      PUBLIC_CATALOG: true,
      PUBLIC_SUBMISSION: false,
      VOTING: false,
      RESULTS: false,
    });
  });

  it('returns collectedIdeasCount for published initiatives only', async () => {
    const now = new Date();
    const base = {
      expertOrg: null,
      title: 'Idea',
      description: 'Description long enough for validation',
      topicId: null,
      territoryType: 'CITYWIDE' as const,
      address: null,
      latitude: null,
      longitude: null,
      isTop20: false,
      createdAt: now,
      updatedAt: now,
    };

    prisma.ideas.push(
      {
        id: 'idea-1',
        publicNumber: 1,
        slug: 'resident-published',
        sourceType: 'RESIDENT',
        expertName: 'Иван',
        userId: 'user-1',
        status: 'PUBLISHED',
        submittedAt: now,
        publishedAt: now,
        ...base,
      },
      {
        id: 'idea-2',
        publicNumber: 2,
        slug: 'expert-published',
        sourceType: 'EXPERT',
        expertName: 'Эксперт',
        userId: null,
        status: 'PUBLISHED',
        submittedAt: null,
        publishedAt: now,
        ...base,
      },
      {
        id: 'idea-3',
        publicNumber: 3,
        slug: 'resident-moderation',
        sourceType: 'RESIDENT',
        expertName: 'Пётр',
        userId: 'user-2',
        status: 'MODERATION',
        submittedAt: now,
        publishedAt: null,
        ...base,
      },
      {
        id: 'idea-4',
        publicNumber: 4,
        slug: 'expert-draft',
        sourceType: 'EXPERT',
        expertName: 'Черновик',
        userId: null,
        status: 'DRAFT',
        submittedAt: null,
        publishedAt: null,
        ...base,
      },
    );

    const res = await request(server()).get('/public/config').expect(200);
    expect(res.body.collectedIdeasCount).toBe(2);
  });
});
