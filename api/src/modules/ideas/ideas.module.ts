import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditModule } from '../audit/audit.module';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';
import { IdeaImageService } from './idea-image.service';
import { VotesAdminController } from './votes-admin.controller';
import { VotesAdminService } from './votes-admin.service';

@Module({
  imports: [AdminAuthModule, AuditModule],
  controllers: [IdeasController, VotesAdminController],
  providers: [IdeasService, IdeaImageService, VotesAdminService],
  exports: [IdeaImageService],
})
export class IdeasModule {}
