import { $Enums } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateChannelDTO {
  @IsString()
  @Length(3, 46)
  name: string;

  @IsInt()
  serverId: number;

  @IsEnum($Enums.ChannelType)
  type: $Enums.ChannelType;

  @IsString()
  @IsOptional()
  description?: string;
}
