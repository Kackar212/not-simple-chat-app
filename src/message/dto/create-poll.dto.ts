import { PollType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class Answer {
  @MinLength(1)
  @MaxLength(250)
  answer: string;

  @IsBoolean()
  @IsOptional()
  isCorrectAnswer?: boolean;
}

export class CreatePollDTO {
  @IsEnum(PollType)
  type: PollType;

  @MinLength(3)
  @MaxLength(300)
  question: string;

  @Type(() => Answer)
  @ValidateNested({ each: true })
  @IsNotEmpty()
  answers: Answer[];

  @IsInt()
  channelId: number;
}
