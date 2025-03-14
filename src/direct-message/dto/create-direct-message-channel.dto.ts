import { IsString, Length } from 'class-validator';

export class CreateDirectMessageChannelDTO {
  @IsString()
  @Length(3, 24)
  username: string;

  serverId: number;
}
