import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitPublicIdeaDto {
  @IsUUID()
  topicId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(50)
  @MaxLength(3000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;

  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;
}
