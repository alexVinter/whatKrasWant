import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Category, District, SystemSetting } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PublicConfigController } from './public-config.controller';
import { PublicConfigService } from './public-config.service';

function buildCategory(overrides: Partial<Category>): Category {
  const now = new Date();
  return {
    id: `cat-${Math.random().toString(36).slice(2)}`,
    name: 'Category',
    slug: `slug-${Math.random().toString(36).slice(2)}`,
    description: null,
    icon: null,
    color: null,
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

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
  categories: Category[] = [];
  districts: District[] = [];
  settings: SystemSetting[] = [];

  category = {
    findMany: (args: {
      where?: { isActive?: boolean };
    }): Promise<Category[]> => {
      const filtered = this.categories.filter(
        (c) => args.where?.isActive === undefined || c.isActive === args.where.isActive,
      );
      return Promise.resolve(
        filtered.sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      );
    },
  };

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
}

describe('PublicConfigController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    prisma.categories.push(
      buildCategory({ name: 'Активная A', slug: 'active-a', sortOrder: 2, isActive: true }),
      buildCategory({ name: 'Активная B', slug: 'active-b', sortOrder: 1, isActive: true }),
      buildCategory({ name: 'Отключённая', slug: 'hidden', sortOrder: 3, isActive: false }),
    );
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

  it('excludes inactive categories and districts', async () => {
    const res = await request(server()).get('/public/config').expect(200);

    const categoryNames = res.body.categories.map((c: { name: string }) => c.name);
    expect(categoryNames).toEqual(['Активная B', 'Активная A']);
    expect(categoryNames).not.toContain('Отключённая');

    const districtNames = res.body.districts.map((d: { name: string }) => d.name);
    expect(districtNames).toEqual(['Активный']);
    expect(districtNames).not.toContain('Отключённый');
  });

  it('does not expose internal category fields or district geometry', async () => {
    const res = await request(server()).get('/public/config').expect(200);

    expect(Object.keys(res.body.categories[0]).sort()).toEqual([
      'id',
      'name',
      'slug',
    ]);
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
});
