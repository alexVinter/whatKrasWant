import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsXlsxService } from './xlsx.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [StatisticsController],
  providers: [StatisticsService, StatisticsXlsxService],
})
export class StatisticsModule {}
