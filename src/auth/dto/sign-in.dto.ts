import { IsString, IsStrongPassword, Length } from 'class-validator';

export class SignInDTO {
  @IsString()
  @Length(3, 24)
  username: string;

  @IsStrongPassword()
  password: string;

  constructor(data: SignInDTO) {
    Object.assign(this, data);
  }
}
