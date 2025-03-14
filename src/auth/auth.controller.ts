import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LoginGuard } from './guards/login.guard';
import { AuthService } from './auth.service';
import {
  CreateUserDTO,
  ResetPasswordDTO,
  ResetPasswordRequestDTO,
} from './dto';
import { SessionGuard } from 'src/common/guards';
import { RequestWithUser } from 'src/common/interfaces';
import { $Enums, Status } from '@prisma/client';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() userData: CreateUserDTO) {
    return this.authService.createUser(userData);
  }

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginGuard)
  async login(@Req() { user }: RequestWithUser) {
    const shouldSetState = !user.isInvisible && user.status === Status.Offline;

    if (shouldSetState) {
      await this.authService.setStatus(user.id, $Enums.Status.Online);
    }

    return this.authService.getUserWithMember(user);
  }

  @Post('/logout')
  @UseGuards(SessionGuard)
  async logout(@Req() request: RequestWithUser) {
    await this.authService.logout(request.user);

    request.logOut(() => false);

    request.res?.clearCookie('connect.sid');
    request.res?.clearCookie('user');

    return {};
  }

  @Post('/reset-password-request')
  resetPasswordRequest(@Body() { email }: ResetPasswordRequestDTO) {
    return this.authService.resetPasswordRequest(email);
  }

  @Patch('/account')
  async activateAccount(@Query('token') token: string) {
    return await this.authService.activateAccount(token);
  }

  @Patch('/reset-password')
  @UseGuards()
  resetPassword(@Body() resetPasswordDTO: ResetPasswordDTO) {
    return this.authService.resetPassword(resetPasswordDTO);
  }
}
