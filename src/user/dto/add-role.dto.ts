import { IsInt, IsString } from 'class-validator';

export class AddRoleDTO {
  @IsInt()
  userId: number;

  @IsString()
  roleName: string;

  @IsInt()
  serverId: number;
}
