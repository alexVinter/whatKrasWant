import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditModule } from '../audit/audit.module';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';
import { IdeaImageService } from './idea-image.service';

@Module({
  imports: [AdminAuthModule, AuditModule],
  controllers: [IdeasController],
  providers: [IdeasService, IdeaImageService],
  exports: [IdeaImageService],
})
export class IdeasModule {}
