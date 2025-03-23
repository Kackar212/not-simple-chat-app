import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  PrismaService,
  Member,
  getHttpException,
  User,
  rooms,
  SocketEvent,
} from 'src/common';
import { CreateChannelDTO } from 'src/channel/dto/create-channel.dto';
import { MessageService } from 'src/message/message.service';
import { CreateMessageDTO } from 'src/message/dto/create-message.dto';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { Channel, Message } from '@prisma/client';
import { GetMessagesQuery } from './dto/get-messages-query.dto';
import { DirectMessageService } from 'src/direct-message/direct-message.service';

@Injectable()
export class ChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketGateway: SocketGateway,
    private readonly messageService: MessageService,
    private readonly directMessageService: DirectMessageService,
  ) {}

  async create(
    { serverId, name, description, type }: CreateChannelDTO,
    user: User,
  ) {
    try {
      const channel = await this.prisma.channel.create({
        data: {
          serverId,
          name: [name],
          createdBy: user.username,
          description,
          type,
        },
        include: {
          channelUsers: true,
        },
      });

      this.socketGateway.server
        .to(rooms.server(serverId))
        .emit(SocketEvent.Channel, channel);

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async createMessage(
    { message, channelId, replyTo }: CreateMessageDTO,
    attachments: Express.Multer.File[],
    member: Member,
  ) {
    if (message.length === 0 && attachments.length === 0) {
      throw new BadRequestException({
        error: 'Bad Request',
        message: ['message must be longer than or equal to 1 characters'],
        statusCode: 400,
      });
    }

    try {
      const channel = await this.directMessageService.get(member, channelId);

      const isBlocked = await this.prisma.blacklist.findFirst({
        where: {
          OR: [
            {
              blacklistOwnerUsername: member.user.username,
              blockedUsername: { in: channel?.name },
            },
            {
              blacklistOwnerUsername: { in: channel?.name },
              blockedUsername: member.user.username,
            },
          ],
        },
        take: 1,
      });

      if (!!isBlocked) {
        throw new ForbiddenException(
          'You cannot send a message in this private channel!',
        );
      }

      const participants = await this.prisma.channelUser.updateManyAndReturn({
        where: {
          channelId,
          isChannelHidden: true,
        },
        data: {
          isChannelHidden: false,
        },
        select: {
          member: {
            select: {
              user: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      });

      const privateRooms = participants.map(
        ({
          member: {
            user: { username },
          },
        }) => rooms.privateRoom(username),
      );

      this.socketGateway.server
        .to(privateRooms)
        .emit(SocketEvent.DirectMessageChannel, channel);
    } catch {}

    const newMessage = await this.messageService.create(
      {
        member,
        message,
        channelId,
        replyTo,
      },
      attachments,
    );

    this.messageService.emit(this.socketGateway.server, newMessage);

    return {};
  }

  async getMessages(
    channel: Channel,
    user: User,
    isRequestAccepted: boolean | null,
    { perPage, around, after = around, before, isPinned }: GetMessagesQuery,
  ) {
    const take = after ? -perPage - 2 : perPage + 1;
    const cursor = after || before || around;
    const include = {
      embeds: {
        select: {
          embed: true,
        },
      },
      messageReference: {
        select: {
          message: true,
          id: true,
          type: true,
          member: {
            select: {
              user: {
                select: {
                  avatar: true,
                  username: true,
                  id: true,
                  displayName: true,
                },
              },
              roles: {
                take: 1,
                select: {
                  role: {
                    select: {
                      color: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      member: {
        include: {
          roles: {
            take: 1,
            select: {
              role: {
                select: {
                  color: true,
                },
              },
            },
          },
          profile: true,
          user: {
            select: {
              avatar: true,
              username: true,
              id: true,
              displayName: true,
            },
          },
        },
      },
      attachments: true,
      poll: {
        include: {
          answers: true,
          pollUserAnswers: {
            include: {
              pollAnswer: true,
            },
          },
        },
      },
    } as const;

    let messages = [] as Message[];

    if (around) {
      messages = (
        await this.prisma.$transaction([
          this.prisma.message.findMany({
            where: {
              channelId: channel.id,
              member: {
                isBanned: false,
              },
            },
            include,
            orderBy: {
              createdAt: isRequestAccepted === false ? 'asc' : 'desc',
            },
            take: isRequestAccepted === false ? -1 : -26,
            skip: 1,
            cursor: { id: around },
          }),
          this.prisma.message.findMany({
            where: {
              channelId: channel.id,
              member: {
                isBanned: false,
              },
            },
            include,
            orderBy: {
              createdAt: isRequestAccepted === false ? 'asc' : 'desc',
            },
            take: isRequestAccepted === false ? 1 : 26,
            cursor: { id: around },
          }),
        ])
      ).flat();
    }

    if (!around) {
      messages = await this.prisma.message.findMany({
        where: {
          channelId: channel.id,
          isPinned,
          member: {
            isBanned: false,
          },
        },
        include,
        orderBy: {
          createdAt: isRequestAccepted === false ? 'asc' : 'desc',
        },
        take: isRequestAccepted === false ? 1 : take,
        cursor: cursor
          ? {
              id: cursor,
            }
          : undefined,
      });
    }

    const messageIds = messages.map(({ id }) => id);
    const reactions = await this.messageService.getReactions(user, messageIds);

    const messagesWithReactions = messages.map((message) => {
      const messageReactions = reactions[message.id] || [];

      return {
        ...message,
        reactions: messageReactions,
      };
    });

    const hasPreviousCursor =
      (!!cursor && messagesWithReactions.length === Math.abs(take)) ||
      (!!around && messagesWithReactions.length < perPage);
    const hasNextCursor = messagesWithReactions.length > perPage;
    const previousCursor = hasPreviousCursor
      ? before
        ? messagesWithReactions.at(-1)?.id
        : messagesWithReactions.at(0)?.id
      : null;

    if (hasPreviousCursor && (take === -52 || around)) {
      messagesWithReactions.shift();
    }

    const message = before
      ? messagesWithReactions.at(0)
      : messagesWithReactions.at(-1);

    if (isRequestAccepted === false && channel.createdBy === user.username) {
      messagesWithReactions.splice(0);
    }

    const nextCursor = hasNextCursor ? message?.id : null;

    if (
      (hasNextCursor || hasPreviousCursor) &&
      messagesWithReactions.length > perPage
    ) {
      messagesWithReactions.pop();
    }

    return {
      messages: messagesWithReactions,
      cursor: nextCursor,
      previousCursor,
      hasPreviousCursor,
      hasNextCursor,
    };
  }
}
