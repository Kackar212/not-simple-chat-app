import { IsInt } from "class-validator";

export class ServerDTO {
  @IsInt()
  serverId: number;
}
