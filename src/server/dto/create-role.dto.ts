import { Type } from "class-transformer";
import { IsArray, IsInt, IsString, ValidateNested } from "class-validator";

export class CreateRoleDTO {
  @IsString()
  name: string;

  @IsArray()
  allowed: string[];

  @IsArray()
  denied: string[];

  @IsInt()
  serverId: number;
}
