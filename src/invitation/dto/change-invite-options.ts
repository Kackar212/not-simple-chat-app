import { IsInt, IsOptional } from "class-validator";

export class ChangeInviteOptionsDTO {
  @IsInt()
  @IsOptional()
  expiresIn: number;

  @IsInt()
  @IsOptional()
  numberOfUses: number;

  @IsInt()
  serverId: number;
}
