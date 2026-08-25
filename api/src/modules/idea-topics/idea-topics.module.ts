import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { IdeaTopicsController } from './idea-topics.controller';
import { IdeaTopicsService } from './idea-topics.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [IdeaTopicsController],
  providers: [IdeaTopicsService],
})
export class IdeaTopicsModule {}
