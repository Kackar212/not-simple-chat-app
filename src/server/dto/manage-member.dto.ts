import { IsBoolean, IsInt, ValidateIf } from 'class-validator';

export class ManageMemberDTO {
  @IsInt()
  memberId: number;

  @IsBoolean()
  @ValidateIf(({ isKicked }) => !isKicked)
  isBanned?: boolean;

  @IsBoolean()
  @ValidateIf(({ isBanned }) => !isBanned)
  isKicked?: boolean;
}
