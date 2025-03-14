import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { $Enums, Prisma } from '@prisma/client';
import {
  getHttpException,
  PrismaService,
  rooms,
  SocketEvent,
  User,
  exclude,
  ErrorCode,
  Member,
} from 'src/common';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { CreateDirectMessageChannelDTO } from 'src/direct-message/dto/create-direct-message-channel.dto';
import { ServerService } from 'src/server/server.service';

@Injectable()
export class DirectMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: SocketGateway,
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
  ) {}

  async create(
    member: Prisma.MemberGetPayload<{ include: { user: true } }>,
    { username }: CreateDirectMessageChannelDTO,
  ) {
    const { user } = member;

    if (user.username === username) {
      throw new BadRequestException({
        code: ErrorCode.SelfInvited,
        message: 'You cant create chat with yourself.',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    try {
      const server = await this.serverService.getGlobalServer({
        select: {
          id: true,
        },
      });

      const members = await this.serverService.getGlobalServerMembers({
        where: {
          user: {
            username: {
              in: [user.username, username],
            },
          },
        },
        select: {
          id: true,
        },
        take: 2,
      });

      let channel = await this.prisma.channel.findFirst({
        where: {
          name: {
            hasEvery: [username, user.username],
          },
          server: {
            isGlobalServer: true,
          },
        },
        include: {
          channelUsers: {
            where: {
              member: {
                userId: {
                  not: user.id,
                },
              },
            },
            select: {
              memberId: true,
              member: {
                select: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (channel) {
        await this.prisma.channelUser.updateMany({
          where: {
            channelId: channel.id,
            member: {
              userId: user.id,
            },
          },
          data: {
            isChannelHidden: false,
          },
        });
      }

      if (!channel) {
        const friend = await this.prisma.friend.findUnique({
          where: {
            friendName_username: {
              username: user.username,
              friendName: username,
            },
          },
          select: {
            isPending: true,
          },
        });

        const isRequestAccepted = friend && !friend.isPending;

        channel = await this.prisma.channel.create({
          data: {
            name: [username, user.username],
            serverId: server.id,
            isPrivate: true,
            isRequestAccepted,
            createdBy: user.username,
            channelUsers: {
              createMany: {
                data: members.map(({ id: memberId }) => ({ memberId })),
              },
            },
            messages: isRequestAccepted
              ? undefined
              : {
                  create: {
                    message: '',
                    type: $Enums.MessageType.Request,
                    memberId: member.id,
                  },
                },
          },
          include: {
            channelUsers: {
              where: {
                memberId: {
                  not: member.id,
                },
              },
              select: {
                memberId: true,
                member: {
                  select: {
                    user: {
                      select: {
                        displayName: true,
                        avatar: true,
                        username: true,
                        status: true,
                        id: true,
                        backgroundColor: true,
                        backgroundImage: true,
                        createdAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      }

      const [
        {
          member: { user: recipient },
          memberId,
        },
      ] = channel.channelUsers;

      this.websocketGateway.server
        .to(rooms.privateRoom(username))
        .emit(SocketEvent.DirectMessageChannel, {
          ...channel,
          recipient: {
            ...user,
            memberId,
          },
        });

      this.websocketGateway.server
        .to(rooms.privateRoom(user.username))
        .emit(SocketEvent.DirectMessageChannel, {
          ...channel,
          recipient: {
            ...recipient,
            memberId,
          },
        });

      await this.prisma.friend.updateMany({
        where: {
          OR: [
            {
              friendName: user.username,
              username,
            },
            {
              username: user.username,
              friendName: username,
            },
          ],
        },
        data: {
          privateChannelId: channel.id,
        },
      });

      return channel!;
    } catch (e) {
      throw getHttpException(e);
    }
  }

  find(member: Member, channelId: number) {
    return this.prisma.channel.findUnique({
      where: {
        id: channelId,
        server: {
          isGlobalServer: true,
        },
        channelUsers: {
          some: {
            memberId: member.id,
            isChannelHidden: false,
          },
        },
      },
      select: {
        isRequestAccepted: true,
        channelUsers: {
          where: {
            memberId: {
              not: member.id,
            },
          },
          select: {
            memberId: true,
            member: {
              select: {
                user: {
                  select: {
                    displayName: true,
                    avatar: true,
                    username: true,
                    status: true,
                    id: true,
                    backgroundColor: true,
                    backgroundImage: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
        id: true,
        name: true,
      },
    });
  }

  async get(member: Member, channelId: number) {
    const channel = await this.find(member, channelId);

    if (!channel) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Channel not found!',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const { user } = member;
    const [
      {
        member: { user: recipient },
        memberId,
      },
    ] = channel.channelUsers;

    const { username: recipientUsername } = recipient;

    const friend = await this.prisma.friend.findUnique({
      where: {
        friendName_username: {
          friendName: recipientUsername,
          username: user.username,
        },
      },
      select: {
        isPending: true,
        isInvited: true,
      },
    });

    const isRecipientBlocked = Boolean(
      await this.prisma.blacklist.findUnique({
        where: {
          blockedUsername_blacklistOwnerUsername: {
            blockedUsername: recipientUsername,
            blacklistOwnerUsername: user.username,
          },
        },
      }),
    );

    const isCurrentUserBlocked = Boolean(
      await this.prisma.blacklist.findUnique({
        where: {
          blockedUsername_blacklistOwnerUsername: {
            blockedUsername: user.username,
            blacklistOwnerUsername: recipientUsername,
          },
        },
      }),
    );

    const excludedKeys = ['password', 'resetPasswordToken', 'email'] as Array<
      keyof User
    >;

    if (!channel.isRequestAccepted) {
      excludedKeys.push('status');
    }

    const recipientWithoutStatus = exclude(recipient, ['status']);
    const recipientUser = channel.isRequestAccepted
      ? recipient
      : recipientWithoutStatus;

    return {
      ...channel,
      isBlocked: isRecipientBlocked,
      recipient: {
        ...recipientUser,
        isFriend: !!friend && !friend.isPending,
        isInvited: !!friend && friend.isInvited && friend.isPending,
        hasFriendRequest: !!friend && friend.isPending,
        isBlocked: isRecipientBlocked,
        isCurrentUserBlocked,
        memberId,
      },
      isRequestAccepted: channel.isRequestAccepted,
      channelUsers: undefined,
    };
  }

  async getAll(user: User) {
    const channels = await this.prisma.channel.findMany({
      where: {
        AND: {
          server: {
            name: this.configService.get('GLOBAL_SERVER_NAME'),
            isGlobalServer: true,
          },
          channelUsers: {
            some: {
              isChannelHidden: false,
              member: {
                user: {
                  username: {
                    equals: user.username,
                  },
                },
              },
            },
          },
        },
      },
      select: {
        channelUsers: {
          where: {
            member: {
              userId: {
                not: user.id,
              },
            },
          },
          select: {
            member: {
              select: {
                user: {
                  select: {
                    displayName: true,
                    avatar: true,
                    username: true,
                    status: true,
                    id: true,
                    backgroundColor: true,
                    backgroundImage: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
        name: true,
        id: true,
        isRequestAccepted: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const transformedChannels = channels.map(({ channelUsers, ...channel }) => {
      const recipient = channelUsers.map(({ member: { user } }) => user).at(0);
      return {
        ...channel,
        recipient: { ...recipient, isFriend: false, isInvited: false },
        serverId: undefined,
      };
    });

    return transformedChannels;
  }

  async accept(channelId: number, messageId: number, user: User) {
    try {
      const channel = await this.prisma.channel.update({
        where: {
          id: channelId,
          channelUsers: {
            some: {
              member: {
                user: {
                  id: user.id,
                },
              },
            },
          },
          server: {
            isGlobalServer: true,
          },
        },
        data: {
          isRequestAccepted: true,
        },
        include: {
          server: {
            select: {
              ownerId: true,
            },
          },
          channelUsers: {
            where: {
              member: {
                userId: { not: user.id },
              },
            },
            select: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      const [
        {
          member: { id: messageAuthorMemberId, user: host },
        },
      ] = channel.channelUsers;

      await this.prisma.message.delete({
        where: {
          id: messageId,
          memberId: messageAuthorMemberId,
          type: $Enums.MessageType.Request,
        },
      });

      this.websocketGateway.server
        .to([
          rooms.privateRoom(host.username),
          rooms.privateRoom(user.username),
        ])
        .emit(SocketEvent.DirectMessageChannel, channel);

      return channel;
    } catch (e) {
      throw new ForbiddenException(
        'Only invited user can accept the direct message request',
      );
    }
  }

  async delete(channelId: number, messageId: number, user: User) {
    const member = await this.serverService.getGlobalServerMember({
      where: {
        userId: user.id,
      },
      include: {
        user: true,
      },
    });

    if (!member) {
      Logger.fatal('Member does not exists on global server!');

      throw new InternalServerErrorException({
        code: ErrorCode.Internal,
        message:
          'Internal server error: Member does not exists on global server',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    const channel = await this.get(member, channelId);

    console.log(channel);

    if (!channel) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Channel does not exists!',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const userRooms = channel.name.map((username) =>
      rooms.privateRoom(username),
    );

    const broadcast = this.websocketGateway.server.to(userRooms);

    try {
      if (channel.isRequestAccepted) {
        await this.prisma.channelUser.update({
          where: {
            channelId_memberId: {
              channelId,
              memberId: member.id,
            },
          },
          data: {
            isChannelHidden: true,
          },
        });

        return {};
      }

      await this.prisma.channel.delete({
        where: {
          id: channelId,
        },
      });

      return {};
    } catch (e) {
      throw getHttpException(e);
    } finally {
      broadcast.emit(SocketEvent.DirectMessageChannel, {
        ...channel,
        isDeleted: true,
      });
    }
  }

  async findOrCreate({
    username,
    member,
    serverId,
  }: {
    username: string;
    member: Member;
    serverId: number;
  }) {
    const { user } = member;

    let channel = await this.prisma.channel.findFirst({
      where: {
        name: { hasEvery: [username, user.username] },
        serverId,
        channelUsers: {
          some: {
            member: {
              userId: user.id,
            },
          },
        },
      },
      take: 1,
    });

    if (!channel) {
      channel = await this.create(member, { username, serverId });
    }

    return channel!;
  }
}
