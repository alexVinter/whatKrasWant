import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';
import { IdeaImageService } from './idea-image.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [IdeasController],
  providers: [IdeasService, IdeaImageService],
})
export class IdeasModule {}
