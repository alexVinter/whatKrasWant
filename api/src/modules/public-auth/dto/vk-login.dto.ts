import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VkLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  accessToken!: string;
}
