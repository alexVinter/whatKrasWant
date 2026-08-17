import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import type { AdminRequest } from '../admin-auth/admin-auth.types';
import { IdeasService } from './ideas.service';
import { IdeaImageService } from './idea-image.service';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';
import { ListIdeasDto } from './dto/list-ideas.dto';
import { MulterExceptionFilter } from '../../common/multer-exception.filter';

// Multer memory cap (bytes). Slightly above the 10 MB business limit so the
// service can return a clean 400 instead of a raw multer error near the edge.
const UPLOAD_HARD_LIMIT = 15 * 1024 * 1024;

@UseGuards(AdminAuthGuard)
@Controller('admin/ideas')
export class IdeasController {
  constructor(
    private readonly ideasService: IdeasService,
    private readonly ideaImageService: IdeaImageService,
  ) {}

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

  @Post(':id/image')
  @HttpCode(200)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: UPLOAD_HARD_LIMIT } }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.ideaImageService.upload(id, file, req.admin!.id);
  }

  @Delete(':id/image')
  @HttpCode(200)
  deleteImage(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.ideaImageService.remove(id, req.admin!.id);
  }

  @Get(':id/image/:variant')
  async getImage(
    @Param('id') id: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ) {
    const object = await this.ideaImageService.getVariant(id, variant);
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    object.body.pipe(res);
  }
}
