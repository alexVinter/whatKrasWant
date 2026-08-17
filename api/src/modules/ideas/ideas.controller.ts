import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import type { AdminRequest } from '../admin-auth/admin-auth.types';
import { IdeasService } from './ideas.service';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';
import { ListIdeasDto } from './dto/list-ideas.dto';

@UseGuards(AdminAuthGuard)
@Controller('admin/ideas')
export class IdeasController {
  constructor(private readonly ideasService: IdeasService) {}

  @Get()
  list(@Query() query: ListIdeasDto) {
    return this.ideasService.list(query);
  }

  @Get('summary')
  summary() {
    return this.ideasService.summary();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateIdeaDto, @Req() req: AdminRequest) {
    return this.ideasService.create(dto, req.admin!.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ideasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIdeaDto,
    @Req() req: AdminRequest,
  ) {
    return this.ideasService.update(id, dto, req.admin!.id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.ideasService.publish(id, req.admin!.id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.ideasService.unpublish(id, req.admin!.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.ideasService.archive(id, req.admin!.id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.ideasService.restore(id, req.admin!.id);
  }

  @Get(':id/revisions')
  revisions(@Param('id') id: string) {
    return this.ideasService.revisions(id);
  }
}
