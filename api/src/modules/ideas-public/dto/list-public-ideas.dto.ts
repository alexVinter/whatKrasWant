import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_PUBLIC_IDEAS_PAGE,
  DEFAULT_PUBLIC_IDEAS_PAGE_SIZE,
  MAX_PUBLIC_IDEAS_PAGE_SIZE,
} from '../public-ideas.constants';

export class ListPublicIdeasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PUBLIC_IDEAS_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PUBLIC_IDEAS_PAGE_SIZE)
  pageSize?: number = DEFAULT_PUBLIC_IDEAS_PAGE_SIZE;
}
