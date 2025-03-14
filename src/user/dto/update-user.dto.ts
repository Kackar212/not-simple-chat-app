import { SpecialStatus, Status } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';

export class UpdateUserDTO {
  @IsBoolean()
  @IsOptional()
  isInvisible: boolean = false;

  @IsNumber()
  @IsOptional()
  serverId?: number;

  @IsNumber()
  profileId: number;

  @IsEnum(Status)
  @IsOptional()
  status?: SpecialStatus | null;
}
