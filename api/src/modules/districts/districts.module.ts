import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditModule } from '../audit/audit.module';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';

@Module({
  imports: [AdminAuthModule, AuditModule],
  controllers: [DistrictsController],
  providers: [DistrictsService],
})
export class DistrictsModule {}
