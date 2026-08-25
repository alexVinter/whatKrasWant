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

export enum IdeaCreateAction {
  DRAFT = 'DRAFT',
  PUBLISH = 'PUBLISH',
}

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateIdeaDto {
  @IsEnum(IdeaCreateAction)
  action!: IdeaCreateAction;

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

  @Transform(trim)
  @IsString()
  @Length(10, 150)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(50, 3000)
  description!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsEnum(TerritoryType)
  territoryType!: TerritoryType;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  districtIds?: string[];

  @IsBoolean()
  hasSpecificPlace!: boolean;

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
}
