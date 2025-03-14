import { IsString } from 'class-validator';

export class InviteDTO {
  @IsString()
  friendName: string;
}
