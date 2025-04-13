import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import {
  ErrorCode,
  Limit,
  PrismaService,
  SocketEvent,
  exclude,
  getHttpException,
  rooms,
} from 'src/common';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { ServerService } from 'src/server/server.service';
import { FriendStatus } from './friend-status.enum';
import { PRISMA_INJECTION_TOKEN } from 'src/common/prisma/prisma.module';

@Injectable()
export class FriendService {
  includeAccepted = {
    user: {
      select: {
        displayName: true,
        username: true,
        status: true,
        id: true,
        avatar: true,
      },
    },
  } as const;
  include = {
    user: {
      select: {
        ...this.includeAccepted.user.select,
        status: false,
      },
    },
  };

  constructor(
    @Inject(PRISMA_INJECTION_TOKEN)
    private readonly prisma: PrismaService,
    private readonly channelSocket: SocketGateway,
    private readonly directMessageService: DirectMessageService,
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
  ) {}

  async inviteFriend(friendName: string, { username: hostUsername }: User) {
    try {
      if (friendName === hostUsername) {
        throw new BadRequestException({
          code: ErrorCode.InvalidFriendUsername,
          message: 'You cant invite yourself!',
          statusCode: HttpStatus.BAD_REQUEST,
        });
      }

      const counts = await this.prisma.$transaction([
        this.prisma.friend.count({
          where: {
            username: friendName,
          },
        }),
        this.prisma.friend.count({
          where: {
            username: hostUsername,
          },
        }),
      ]);

      if (counts[0] === Limit.Friends || counts[1] === Limit.Friends) {
        throw new ForbiddenException({
          code: ErrorCode.LimitReached,
          message: 'Limit reached',
          statusCode: HttpStatus.FORBIDDEN,
        });
      }

      const isBlocked = Boolean(
        await this.prisma.blacklist.findFirst({
          where: {
            OR: [
              {
                blacklistOwnerUsername: hostUsername,
                blockedUsername: friendName,
              },
              {
                blacklistOwnerUsername: friendName,
                blockedUsername: hostUsername,
              },
            ],
          },
        }),
      );

      if (isBlocked) {
        throw new BadRequestException({
          message:
            'You cant invite this user, you blocked him or you are blocked!',
          code: 'USER_BLOCKED',
        });
      }

      const newFriends = await this.prisma.friend.createManyAndReturn({
        data: [
          {
            friendName,
            username: hostUsername,
          },
          {
            friendName: hostUsername,
            username: friendName,
            isInvited: true,
          },
        ],
        include: this.include,
      });

      const host = newFriends.find(({ username }) => hostUsername === username);
      const friend = newFriends.find(({ username }) => friendName === username);

      this.channelSocket.server
        .to(rooms.privateRoom(friendName))
        .emit('friend', host!);

      this.channelSocket.server
        .to(rooms.privateRoom(hostUsername))
        .emit('friend', friend!);

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async acceptFriend({ username: hostUsername }: User, friendName: string) {
    try {
      const privateChannel = await this.prisma.channel.findFirst({
        where: {
          name: {
            hasEvery: [hostUsername, friendName],
          },
          server: {
            isGlobalServer: true,
          },
        },
      });

      const { id: directMessageChannelId } = privateChannel || { id: -1 };

      const invitedUser = await this.prisma.friend.update({
        where: {
          friendName_username: {
            friendName,
            username: hostUsername,
          },
          isInvited: true,
        },
        data: {
          isPending: false,
          privateChannelId: directMessageChannelId,
          isInvited: false,
        },
        include: this.includeAccepted,
      });

      const host = await this.prisma.friend.update({
        where: {
          friendName_username: {
            friendName: hostUsername,
            username: friendName,
          },
        },
        data: {
          isPending: false,
          privateChannelId: directMessageChannelId,
        },
        include: this.includeAccepted,
      });

      const socket = this.channelSocket.server;

      const friendRoom = rooms.privateRoom(friendName);
      const userRoom = rooms.privateRoom(hostUsername);

      socket.to(friendRoom).emit(SocketEvent.Friend, invitedUser);
      socket.to(userRoom).emit(SocketEvent.Friend, host);

      return {};
    } catch (e) {
      console.log(e);
      throw getHttpException(e);
    }
  }

  async getFriends(user: User, hasDM?: boolean, status?: FriendStatus) {
    const isPending = status === FriendStatus.Pending;
    let privateChannelId: number | { not: number } | undefined = undefined;

    if (hasDM) {
      privateChannelId = { not: -1 };
    }

    if (hasDM === false) {
      privateChannelId = -1;
    }

    const friends = await this.prisma.friend.findMany({
      where: {
        friendName: user.username,
        isPending: isPending ? isPending : undefined,
        AND: [isPending || !status ? {} : { user: { status } }],
        privateChannelId,
      },
      include: this.includeAccepted,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return friends.map((friend) => ({
      ...friend,
      user: {
        ...friend.user,
        status: friend.isPending ? FriendStatus.Pending : friend.user.status,
      },
    }));
  }

  async delete(friendName: string, user: User) {
    try {
      const friend = await this.prisma.friend.delete({
        where: {
          friendName_username: {
            friendName: user.username,
            username: friendName,
          },
        },
        include: this.include,
      });

      const host = await this.prisma.friend.delete({
        where: {
          friendName_username: {
            friendName,
            username: user.username,
          },
        },
        include: this.include,
      });

      this.channelSocket.server
        .to(rooms.privateRoom(user.username))
        .emit('friend', { ...friend, isDeleted: true });

      this.channelSocket.server
        .to(rooms.privateRoom(friendName))
        .emit('friend', { ...host, isDeleted: true });

      return host;
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async block(friendName: string, user: User) {
    try {
      const blacklist = await this.prisma.blacklist.create({
        data: {
          blacklistOwnerUsername: user.username,
          blockedUsername: friendName,
        },
        include: {
          blocked: true,
        },
      });

      try {
        const result = await this.delete(friendName, user);

        this.channelSocket.server
          .to(rooms.privateRoom(friendName))
          .emit('friend', result);
      } catch {}

      this.channelSocket.server
        .to(rooms.privateRoom(user.username))
        .emit('block', blacklist.blocked);

      return blacklist.blocked;
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async unblock(friendName: string, user: User) {
    try {
      const blacklist = await this.prisma.blacklist.delete({
        where: {
          blockedUsername_blacklistOwnerUsername: {
            blacklistOwnerUsername: user.username,
            blockedUsername: friendName,
          },
        },
        include: {
          blocked: true,
        },
      });

      const room = rooms.privateRoom(user.username);

      this.channelSocket.server.to(room).emit('unblock', blacklist.blocked);

      return blacklist;
    } catch (e) {
      throw getHttpException(e);
    }
  }
}
