import { Controller, Get } from '@nestjs/common';
import { IdeaTopicsService } from './idea-topics.service';

@Controller('public/idea-topics')
export class PublicIdeaTopicsController {
  constructor(private readonly ideaTopicsService: IdeaTopicsService) {}

  @Get()
  listActive() {
    return this.ideaTopicsService.findActiveForAdmin();
  }
}
