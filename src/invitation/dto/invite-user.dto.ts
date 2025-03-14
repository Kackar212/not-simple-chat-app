import { IsInt, IsString, Length } from 'class-validator';

export class InviteUserDTO {
  @IsInt()
  serverId: number;

  @IsString()
  @Length(3, 24)
  username: string;
}
