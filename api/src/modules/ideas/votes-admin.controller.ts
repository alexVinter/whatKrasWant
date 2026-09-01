import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import type { AdminRequest } from '../admin-auth/admin-auth.types';
import { VoteModerationDto } from './dto/vote-moderation.dto';
import { VotesAdminService } from './votes-admin.service';

@UseGuards(AdminAuthGuard)
@Controller('admin')
export class VotesAdminController {
  constructor(private readonly votesAdmin: VotesAdminService) {}

  @Get('ideas/:id/votes/summary')
  getIdeaVoteSummary(@Param('id') id: string) {
    return this.votesAdmin.getIdeaVoteSummary(id);
  }

  @Post('votes/:voteId/exclude')
  @HttpCode(200)
  excludeVote(
    @Param('voteId') voteId: string,
    @Body() dto: VoteModerationDto,
    @Req() req: AdminRequest,
  ) {
    return this.votesAdmin.excludeVote(voteId, req.admin!.id, dto.reason);
  }

  @Post('votes/:voteId/restore')
  @HttpCode(200)
  restoreVote(@Param('voteId') voteId: string, @Req() req: AdminRequest) {
    return this.votesAdmin.restoreVote(voteId, req.admin!.id);
  }
}
