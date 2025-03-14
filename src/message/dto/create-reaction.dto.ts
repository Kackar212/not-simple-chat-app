import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class Emoji {
  @IsInt()
  @IsOptional()
  id: number;

  @IsString()
  @MaxLength(50)
  name: string;
}

export class CreateReactionDTO {
  @Type(() => Emoji)
  @ValidateNested()
  emoji: { id?: number; name: string };

  @IsInt()
  messageId: number;
}
