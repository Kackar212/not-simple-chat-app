import { IsStrongPassword } from 'class-validator';

export class ResetPasswordDTO {
  @IsStrongPassword()
  oldPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
