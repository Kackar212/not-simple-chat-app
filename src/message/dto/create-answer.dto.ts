import { IsInt } from 'class-validator';

export class CreateUserAnswerDTO {
  @IsInt()
  messageId: number;

  @IsInt()
  answerId: number;
}
