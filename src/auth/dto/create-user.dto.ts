import { Transform } from 'class-transformer';
import {
  IsAlphanumeric,
  IsEmail,
  IsStrongPassword,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateUserDTO {
  @Matches(/[a-zA-Z]/, { message: 'Must have at least 3 letter(s)!' })
  @IsAlphanumeric()
  @Length(3, 28)
  @Transform(({ value }) => value.trim())
  username: string;

  @Matches(/[a-zA-Z]/, { message: 'Must have at least 3 letter(s)!' })
  @Length(3, 28)
  @Transform(({ value }) => value.trim())
  displayName: string;

  @IsEmail()
  email: string;

  @IsStrongPassword({ minSymbols: 3 })
  @MaxLength(32)
  password: string;
}
