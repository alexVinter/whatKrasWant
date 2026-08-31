import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { IdeaTopicsController } from './idea-topics.controller';
import { PublicIdeaTopicsController } from './public-idea-topics.controller';
import { IdeaTopicsService } from './idea-topics.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [IdeaTopicsController, PublicIdeaTopicsController],
  providers: [IdeaTopicsService],
  exports: [IdeaTopicsService],
})
export class IdeaTopicsModule {}
