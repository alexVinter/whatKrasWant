import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateNewsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 20000)
  body?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString()
  publishDate?: string | null;
}
