import { Module } from '@nestjs/common';
import { IdeasModule } from '../ideas/ideas.module';
import { PublicAuthModule } from '../public-auth/public-auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PublicIdeasController } from './public-ideas.controller';
import { PublicMapController } from './public-map.controller';
import { PublicIdeasService } from './public-ideas.service';
import { PublicSubmissionService } from './public-submission.service';

@Module({
  imports: [SettingsModule, IdeasModule, PublicAuthModule],
  controllers: [PublicIdeasController, PublicMapController],
  providers: [PublicIdeasService, PublicSubmissionService],
})
export class IdeasPublicModule {}
