import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  SETTINGS_ENTITY_ID,
} from '../audit/audit.constants';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
  type FeatureFlags,
} from './settings.constants';

function emptyFlags(): FeatureFlags {
  return {
    PUBLIC_CATALOG: false,
    PUBLIC_SUBMISSION: false,
    VOTING: false,
    RESULTS: false,
  };
}

function asBoolean(value: Prisma.JsonValue | undefined): boolean {
  return value === true;
}

function flagsEqual(a: FeatureFlags, b: FeatureFlags): boolean {
  return FEATURE_FLAG_KEYS.every((key) => a[key] === b[key]);
}

function flagsSnapshot(flags: FeatureFlags): Prisma.InputJsonObject {
  return {
    PUBLIC_CATALOG: flags.PUBLIC_CATALOG,
    PUBLIC_SUBMISSION: flags.PUBLIC_SUBMISSION,
    VOTING: flags.VOTING,
    RESULTS: flags.RESULTS,
  };
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<FeatureFlags> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...FEATURE_FLAG_KEYS] } },
    });
    return this.toFlags(rows);
  }

  async update(dto: UpdateSettingsDto, adminId: string): Promise<FeatureFlags> {
    const next = this.fromDto(dto);
    const current = await this.get();

    if (flagsEqual(current, next)) {
      return current;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const key of FEATURE_FLAG_KEYS) {
        await tx.systemSetting.upsert({
          where: { key },
          create: {
            key,
            value: next[key],
            updatedBy: adminId,
          },
          update: {
            value: next[key],
            updatedBy: adminId,
          },
        });
      }

      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          entityType: AUDIT_ENTITIES.SETTINGS,
          entityId: SETTINGS_ENTITY_ID,
          beforeJson: flagsSnapshot(current),
          afterJson: flagsSnapshot(next),
        },
        tx,
      );
    });

    return next;
  }

  private toFlags(
    rows: { key: string; value: Prisma.JsonValue }[],
  ): FeatureFlags {
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const flags = emptyFlags();
    for (const key of FEATURE_FLAG_KEYS) {
      flags[key] = asBoolean(byKey.get(key));
    }
    return flags;
  }

  private fromDto(dto: UpdateSettingsDto): FeatureFlags {
    const flags = emptyFlags();
    for (const key of FEATURE_FLAG_KEYS) {
      flags[key] = dto[key as FeatureFlagKey];
    }
    return flags;
  }
}
