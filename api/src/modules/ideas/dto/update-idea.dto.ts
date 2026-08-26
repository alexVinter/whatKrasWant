import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TerritoryType } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateIdeaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  expertName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  expertOrg?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(10, 150)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(50, 3000)
  description?: string;

  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsOptional()
  @IsEnum(TerritoryType)
  territoryType?: TerritoryType;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  districtIds?: string[];

  @IsOptional()
  @IsBoolean()
  hasSpecificPlace?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
