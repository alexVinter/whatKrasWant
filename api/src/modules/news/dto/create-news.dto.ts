import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export enum NewsCreateAction {
  DRAFT = 'DRAFT',
  PUBLISH = 'PUBLISH',
}

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateNewsDto {
  @IsEnum(NewsCreateAction)
  action!: NewsCreateAction;

  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 20000)
  body!: string;

  @IsOptional()
  @IsDateString()
  publishDate?: string;
}
