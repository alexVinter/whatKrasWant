import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [IdeasController],
  providers: [IdeasService],
})
export class IdeasModule {}
