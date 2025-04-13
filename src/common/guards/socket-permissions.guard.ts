import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma, Server } from '@prisma/client';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { PermissionType } from '../decorators';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_INJECTION_TOKEN } from '../prisma/prisma.module';

@Injectable()
export class WebsocketServerPermissionsGuard implements CanActivate {
  permissions: Array<string> = [];

  constructor(
    @Inject(PRISMA_INJECTION_TOKEN)
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  getRoles(userId: number, serverId: number) {
    const where: Prisma.UserRoleWhereInput & {
      AND: Prisma.UserRoleWhereInput[];
      OR: Prisma.UserRoleWhereInput[];
    } = {
      AND: [
        {
          role: {
            serverId,
            permissions: {
              every: {
                isAllowed: true,
              },
            },
          },
        },
        { member: { userId } },
      ],
      OR: [],
    };

    return this.prisma.userRole.findMany({
      where,
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });
  }

  #isServerOwner(userId: number, server: Server) {
    return server.ownerId === userId;
  }

  async handleServerPermissionsGuard(
    request: RequestWithUser,
    userId: number,
    serverId?: number,
  ) {
    if (!serverId) {
      throw new BadRequestException('There is no server id in the request!');
    }

    const server = await this.prisma.server.findUnique({
      where: {
        id: serverId,
        members: {
          some: {
            user: {
              id: userId,
            },
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!server) {
      throw new BadRequestException(
        'User is not a member of this server or server does not exists!',
      );
    }

    if (this.#isServerOwner(userId, server)) {
      return true;
    }

    if (!server?.members.find((member) => member.userId === userId)) {
    }

    const roles = await this.getRoles(userId, serverId);

    return true;
  }

  async handleChannelPermissionsGuard(
    request: RequestWithUser,
    userId: number,
    channelId?: number,
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: {
        id: channelId,
      },
      include: {
        server: true,
        messages: {
          take: 50,
          include: {
            member: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException();
    }

    request.channel = channel;

    const isServerOwner = channel.server.ownerId === userId;

    if (isServerOwner) {
      return true;
    }

    const roles = await this.getRoles(userId, channel.serverId);

    const userPermissions = roles.flatMap(({ role: { permissions } }) => [
      ...permissions.map(({ permission }) => permission),
    ]);

    const canUserPerformAction = userPermissions.some((permission) =>
      this.permissions.includes(permission),
    );

    return true;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const wsContext = context.switchToWs();
    const { request } = wsContext.getClient();
    const data = wsContext.getData();

    this.permissions = this.reflector.get(
      PermissionType.Server,
      context.getHandler(),
    );

    const { serverId, channelId } = data;

    const {
      user: { id: userId },
    } = request;
    if (!channelId) {
      return this.handleServerPermissionsGuard(request, +userId, +serverId);
    }

    return this.handleChannelPermissionsGuard(request, +userId, +channelId);
  }
}
