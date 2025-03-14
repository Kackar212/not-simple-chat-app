import { IsInt, IsString, MaxLength } from 'class-validator';

export class DeleteReactionDTO {
  @IsString()
  @MaxLength(50)
  emojiName: string;

  @IsInt()
  messageId: number;
}
