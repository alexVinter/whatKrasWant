import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoteModerationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
