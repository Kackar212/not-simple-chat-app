import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class EditMessageDTO {
  @IsInt()
  messageId: number;

  @IsString()
  @Length(1, 500)
  @IsOptional()
  message?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
