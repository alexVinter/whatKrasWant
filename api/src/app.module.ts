import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { HealthModule } from './modules/health/health.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { PublicConfigModule } from './modules/public-config/public-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AdminAuthModule,
    CategoriesModule,
    DistrictsModule,
    IdeasModule,
    PublicConfigModule,
  ],
})
export class AppModule {}
