import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [DistrictsController],
  providers: [DistrictsService],
})
export class DistrictsModule {}
