import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { PermissionType } from '../decorators';
import { Prisma } from '@prisma/client';
import { ServerEntity as Server } from 'src/common';
import { PRISMA_INJECTION_TOKEN } from '../prisma/prisma.module';

@Injectable()
export class ServerPermissionsGuard implements CanActivate {
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
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                user: {
                  id: userId,
                },
                isBanned: false,
              },
            },
          },
        ],
      },
      include: {
        members: {
          include: {
            user: true,
          },
          take: 1,
        },
        inviteLink: true,
      },
    });

    request.server = server as Server;

    if (!server) {
      throw new BadRequestException(
        'User is not a member of this server or server does not exists!',
      );
    }

    const [member] = server.members;
    request.member = member;

    if (this.#isServerOwner(userId, server)) {
      return true;
    }

    if (!member) {
      return false;
    }

    const roles = await this.getRoles(userId, serverId);

    const permissions = roles
      .flatMap(({ role: { permissions } }) => permissions)
      .filter(({ isAllowed }) => isAllowed)
      .map(({ permission }) => permission);

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
        channelUsers: true,
        server: {
          include: {
            inviteLink: true,
            members: {
              include: {
                user: true,
              },
            },
          },
        },
        messages: {
          take: 0,
          include: {
            member: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException();
    }

    const member = channel.server.members.find(
      (member) => member.userId === userId && !member.isBanned,
    );

    if (!member) {
      return false;
    }

    if (
      channel.isPrivate &&
      !channel.channelUsers.find((user) => user.memberId === member?.id)
    ) {
      return false;
    }

    request.channel = channel;
    request.member = member;

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

  async handlePermissionsWithMessageId(
    request: RequestWithUser,
    messageId: number,
    userId: number,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId, isSystemMessage: false },
      select: {
        channelId: true,
        member: {
          select: {
            userId: true,
          },
        },
        channel: {
          include: {
            server: {
              include: {
                inviteLink: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return false;
    }

    const member = await this.prisma.member.findUnique({
      where: {
        serverId_userId: {
          serverId: message.channel.serverId,
          userId,
        },
        isBanned: false,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      return false;
    }

    const isServerOwner = message.channel.server.ownerId === userId;
    const isMessageAuthor = message.member.userId === userId;

    request.message = message;
    request.member = member;

    if (isServerOwner || isMessageAuthor) {
      return true;
    }

    // TODO: Check permissions for managing messages

    return true;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    this.permissions = this.reflector.get(
      PermissionType.Server,
      context.getHandler(),
    );

    const {
      serverId = request.body?.serverId,
      channelId = request.body?.channelId,
      messageId = request.body?.messageId,
    } = request.params || {};

    const {
      user: { id: userId },
    } = request;

    if (messageId) {
      return this.handlePermissionsWithMessageId(request, +messageId, +userId);
    }

    if (!channelId) {
      return this.handleServerPermissionsGuard(request, +userId, +serverId);
    }

    return this.handleChannelPermissionsGuard(request, +userId, +channelId);
  }
}
