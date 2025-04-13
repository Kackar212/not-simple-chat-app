import { IsInt } from 'class-validator';

export class RemoveAnswerDTO {
  @IsInt()
  answerId: number;

  @IsInt()
  messageId: number;
}
