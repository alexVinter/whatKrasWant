import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { HealthModule } from './modules/health/health.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { PublicConfigModule } from './modules/public-config/public-config.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AdminAuthModule,
    AuditModule,
    CategoriesModule,
    DistrictsModule,
    IdeasModule,
    PublicConfigModule,
    SettingsModule,
  ],
})
export class AppModule {}
