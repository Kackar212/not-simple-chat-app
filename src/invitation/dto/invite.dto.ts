import { IsInt } from "class-validator";

export class InviteDTO {
  @IsInt()
  serverId: number;
}
