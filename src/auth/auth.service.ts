import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDTO } from './dto/create-user.dto';
import { getHttpException, PrismaService } from 'src/common/prisma';
import { UserService } from 'src/user/user.service';
import { Template } from 'src/common/templates/template.enum';
import { ResetPasswordDTO } from './dto';
import {
  DEFAULT_USER_AVATAR,
  ErrorCode,
  HASH_ROUNDS,
} from 'src/common/constants';
import { buildUrl, exclude } from 'src/common/utilities';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { $Enums, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { ServerService } from 'src/server/server.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
    private readonly socketGateway: SocketGateway,
  ) {}

  async createUser(userData: CreateUserDTO) {
    userData.password = await bcrypt.hash(userData.password, HASH_ROUNDS);

    try {
      const [activateAccountToken, activationTokenExpiresIn] =
        this.createActivationTokenAndTimestamp();

      const newUser = await this.prisma.user.create({
        data: {
          ...userData,
          activateAccountToken,
          activationTokenExpiresIn,
          avatar: new URL(
            `${DEFAULT_USER_AVATAR}`,
            process.env.APP_URL,
          ).toString(),
        },
        omit: {
          activateAccountToken: true,
          isAccountActive: true,
          activationTokenExpiresIn: true,
          password: true,
          resetPasswordToken: true,
        },
      });

      const server = await this.serverService.getGlobalServer({
        select: {
          id: true,
        },
      });

      if (!server) {
        throw new InternalServerErrorException();
      }

      await this.prisma.member.create({
        data: {
          serverId: server.id,
          userId: newUser.id,
          roles: {
            create: {
              roleName: 'everyone',
              roleServerId: server.id,
            },
          },
          profile: {
            create: {
              ...exclude(newUser, [
                'id',
                'updatedAt',
                'createdAt',
                'username',
                'email',
              ]),
              serverId: server.id,
            },
          },
        },
      });

      this.sendActivationToken(newUser.email, activateAccountToken);

      return exclude(newUser, ['email']);
    } catch (e) {
      throw getHttpException(e);
    }
  }

  createActivationTokenAndTimestamp() {
    const activationTokenExpiresIn = new Date(Date.now() + 10 * 60 * 1000);

    return [
      Buffer.from(
        `${activationTokenExpiresIn.getTime()}-${crypto.randomUUID()}`,
      ).toString('base64url'),
      activationTokenExpiresIn,
    ] as const;
  }

  sendActivationToken(email: string, activationToken: string) {
    const url = buildUrl(
      `/auth/activate-account/${activationToken}`,
      this.configService.get('CLIENT_URL')!,
    );

    this.mailerService.sendMail({
      to: email,
      subject: 'Account activation',
      template: Template.ActivateAccount,
      context: {
        url,
      },
    });
  }

  decodeToken(token: string) {
    const decodedToken = decodeURIComponent(token);
    const asciiToken = Buffer.from(decodedToken, 'base64url').toString('ascii');
    const timestamp = Number(asciiToken.split('-')[0]);

    if (Number.isNaN(timestamp)) {
      return {
        decodedToken: '',
        activationTokenExpiresIn: new Date(),
        error: new BadRequestException({
          code: ErrorCode.InvalidToken,
          message: 'Token is invalid',
          statusCode: HttpStatus.BAD_REQUEST,
        }),
      };
    }

    return { decodedToken, activationTokenExpiresIn: new Date(timestamp) };
  }

  async activateAccount(token: string) {
    const { decodedToken, activationTokenExpiresIn, error } =
      this.decodeToken(token);

    if (error) {
      throw error;
    }

    if (Date.now() > activationTokenExpiresIn.getTime()) {
      throw new ForbiddenException({
        code: ErrorCode.TokenExpired,
        message: 'Token has expired',
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    try {
      await this.prisma.user.update({
        where: {
          activateAccountToken: decodedToken,
          activationTokenExpiresIn,
        },
        data: {
          isAccountActive: true,
          activateAccountToken: null,
        },
        omit: {
          email: false,
        },
      });

      return {};
    } catch (e) {
      console.log(e);
      throw getHttpException(e);
    }
  }

  setStatus(userId: number, status: $Enums.Status) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status,
      },
    });
  }

  public async logout(user: User) {
    return await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        status: $Enums.Status.Offline,
      },
    });
  }

  public async getUser(username: string, password: string) {
    const user = await this.userService.findOne({
      where: {
        username,
      },
      omit: {
        password: false,
        isAccountActive: false,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: ErrorCode.WrongCredentials,
        message: 'Incorrect username or password!',
        meta: { modelName: 'User', target: ['username', 'password'] },
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const hasTokenExpired =
      user.activationTokenExpiresIn &&
      user.activationTokenExpiresIn.getTime() > Date.now();

    if (hasTokenExpired) {
      const [activateAccountToken, activationTokenExpiresIn] =
        this.createActivationTokenAndTimestamp();

      this.sendActivationToken(user.email, activateAccountToken);

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          activateAccountToken,
          activationTokenExpiresIn,
        },
      });

      throw new ForbiddenException({
        code: ErrorCode.TokenExpired,
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You need to activate your account!',
      });
    }

    if (!user.isAccountActive) {
      throw new ForbiddenException({
        code: ErrorCode.InactiveAccount,
        message: 'You need to activate your account!',
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    const isPasswordEqual = await bcrypt.compare(password, user.password);

    if (!isPasswordEqual) {
      throw new BadRequestException({
        code: ErrorCode.WrongCredentials,
        message: 'Incorrect username or password!',
        meta: { modelName: 'User', target: ['username', 'password'] },
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    return exclude(user, ['password', 'isAccountActive']);
  }

  async resetPasswordRequest(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return {};
    }

    const resetPasswordToken = Buffer.from(crypto.randomUUID()).toString(
      'base64',
    );

    await this.prisma.user.update({
      where: {
        email,
      },
      data: {
        resetPasswordToken,
      },
    });

    const url = buildUrl(
      '/reset-password',
      this.configService.get<string>('CLIENT_URL')!,
      {
        token: resetPasswordToken,
      },
    );

    this.mailerService.sendMail({
      to: email,
      template: Template.ResetPassword,
      subject: 'Reset password request',
      context: {
        url,
      },
    });

    return {};
  }

  async resetPassword({ resetPasswordToken, newPassword }: ResetPasswordDTO) {
    try {
      await this.prisma.user.update({
        where: {
          resetPasswordToken,
        },
        data: {
          password: await bcrypt.hash(newPassword, HASH_ROUNDS),
          resetPasswordToken: null,
        },
      });

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async getMember(userId: number) {
    const globalServer = await this.serverService.getGlobalServer({});

    return this.userService.getMember(globalServer.id, userId);
  }

  public getUserWithMember(user: User) {
    return this.userService.getUser(user, -1);
  }
}
