import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { HealthModule } from './modules/health/health.module';
import { IdeaTopicsModule } from './modules/idea-topics/idea-topics.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { IdeasPublicModule } from './modules/ideas-public/ideas-public.module';
import { PublicAuthModule } from './modules/public-auth/public-auth.module';
import { PublicConfigModule } from './modules/public-config/public-config.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { NewsModule } from './modules/news/news.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AdminAuthModule,
    PublicAuthModule,
    AuditModule,
    IdeaTopicsModule,
    DistrictsModule,
    IdeasModule,
    IdeasPublicModule,
    PublicConfigModule,
    SettingsModule,
    StatisticsModule,
    NewsModule,
  ],
})
export class AppModule {}
