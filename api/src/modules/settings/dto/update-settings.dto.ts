import { IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsBoolean()
  PUBLIC_CATALOG!: boolean;

  @IsBoolean()
  PUBLIC_SUBMISSION!: boolean;

  @IsBoolean()
  VOTING!: boolean;

  @IsBoolean()
  RESULTS!: boolean;
}
