import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { IdeaTopicsService } from './idea-topics.service';

@UseGuards(AdminAuthGuard)
@Controller('admin/idea-topics')
export class IdeaTopicsController {
  constructor(private readonly ideaTopicsService: IdeaTopicsService) {}

  @Get()
  findAll() {
    return this.ideaTopicsService.findActiveForAdmin();
  }
}
