import { $Enums } from '@prisma/client';
import { IsEnum, IsOptional, Length, Matches } from 'class-validator';

export class CreateEmojiDTO {
  @Matches(/^[a-z0-9_]+$/i)
  @Length(3, 28)
  name: string;

  @IsEnum($Enums.EmojiScope)
  @IsOptional()
  scope: $Enums.EmojiScope = $Enums.EmojiScope.Public;
}
