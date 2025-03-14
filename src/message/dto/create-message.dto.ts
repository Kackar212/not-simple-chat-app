import { $Enums } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateMessageDTO {
  @IsString()
  @Transform(({ value }) => value.trim())
  @Length(0, 1000)
  message: string;

  @Type(() => Number)
  @IsInt()
  channelId: number;

  @IsEnum($Enums.MessageType)
  @IsOptional()
  type?: $Enums.MessageType;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  replyTo?: number;
}
