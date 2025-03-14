import { IsString, IsStrongPassword } from 'class-validator';

export class ResetPasswordDTO {
  @IsString()
  resetPasswordToken: string;

  @IsStrongPassword()
  newPassword: string;
}
