import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import { PublicAuthGuard } from '../public-auth/guards/public-auth.guard';
import { PUBLIC_SESSION_COOKIE } from '../public-auth/public-auth.constants';
import type { PublicRequest } from '../public-auth/public-auth.types';
import { MulterExceptionFilter } from '../../common/multer-exception.filter';
import { PublicIdeasService } from './public-ideas.service';
import { PublicSubmissionService } from './public-submission.service';
import { PublicVoteService } from './public-vote.service';
import { ListPublicIdeasDto } from './dto/list-public-ideas.dto';
import { SubmitPublicIdeaDto } from './dto/submit-public-idea.dto';

const UPLOAD_HARD_LIMIT = 15 * 1024 * 1024;

@Controller('public/ideas')
export class PublicIdeasController {
  constructor(
    private readonly publicIdeasService: PublicIdeasService,
    private readonly publicSubmissionService: PublicSubmissionService,
    private readonly publicVoteService: PublicVoteService,
  ) {}

  @Get()
  list(@Query() query: ListPublicIdeasDto) {
    return this.publicIdeasService.list(query);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(PublicAuthGuard)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: UPLOAD_HARD_LIMIT } }),
  )
  submit(
    @Body() dto: SubmitPublicIdeaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: PublicRequest,
  ) {
    return this.publicSubmissionService.submit(dto, file, req.publicUser!);
  }

  @Post(':slug/vote')
  @HttpCode(201)
  @UseGuards(PublicAuthGuard)
  vote(@Param('slug') slug: string, @Req() req: PublicRequest) {
    return this.publicVoteService.castVote(slug, req.publicUser!, {
      forwardedFor: req.headers['x-forwarded-for'],
      remoteAddress: req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':slug/image/:variant')
  async getImage(
    @Param('slug') slug: string,
    @Param('variant') variant: string,
    @Res() res: Response,
  ) {
    const object = await this.publicIdeasService.getImageVariant(slug, variant);
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    object.body.pipe(res);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string, @Req() req: PublicRequest) {
    const sessionToken = req.cookies?.[PUBLIC_SESSION_COOKIE] as
      | string
      | undefined;
    return this.publicIdeasService.findBySlug(slug, sessionToken);
  }
}
