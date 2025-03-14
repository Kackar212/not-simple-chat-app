import { ForbiddenException, Injectable } from '@nestjs/common';
import { $Enums, FileType, Message, Prisma } from '@prisma/client';
import {
  Member,
  PrismaService,
  SocketEvent,
  UploadDestination,
  User,
  getHttpException,
  rooms,
} from 'src/common';
import { CreateMessageDTO } from './dto/create-message.dto';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { EditMessageDTO } from './dto/edit-message.dto';
import { CreateReactionDTO } from './dto/create-reaction.dto';
import { DeleteReactionDTO } from './dto/delete-reaction.dto';
import { EmbedService } from 'src/embed/embed.service';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { Server } from 'socket.io';
import { unlink } from 'fs/promises';
import { find } from 'linkifyjs';
import path from 'path';

interface CreateMessage extends CreateMessageDTO {
  member: Member;
}

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedService: EmbedService,
    private readonly socketGateway: SocketGateway,
    private readonly directMessageService: DirectMessageService,
  ) {}

  async create(
    { message, channelId, member, type, replyTo }: CreateMessage,
    attachments: Express.Multer.File[],
  ) {
    const links = find(message, 'url', { defaultProtocol: 'https' }).slice(
      0,
      5,
    );

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
    } as const;

    const newMessage = await this.prisma.message.create({
      data: {
        message,
        channelId,
        type,
        memberId: member.id,
        messageReferenceId: replyTo,
        attachments: {
          createMany: {
            data: attachments.map((file) => ({
              name: file.filename,
              contentType: file.mimetype,
              type: this.getFileType(file),
              url: new URL(
                `${UploadDestination.Attachments}/${file.filename}`,
                process.env.APP_URL,
              ).toString(),
              extension: this.getFileExtension(file),
              isSpoiler: file.originalname.startsWith('__SPOILER__'),
              isVoiceClip: file.originalname.startsWith('__VOICECLIP__'),
              size: file.size,
              originalName: file.originalname
                .replace('__SPOILER__', '')
                .replace('__VOICECLIP__', ''),
              height: file.height || -1,
              width: file.width || -1,
              poster: file.poster,
            })),
          },
        },
      },
      include,
    });

    const payload = {
      ...newMessage,
      user: {
        ...newMessage.member,
        roles: newMessage.member.roles,
      },
      reactions: [],
    };

    this.embedService.createEmbeds(links).then(async (embeds) => {
      const messageWithEmbeds = await this.prisma.message.update({
        where: {
          id: payload.id,
        },
        data: {
          embeds: {
            createMany: {
              data: embeds,
            },
          },
        },
        include,
      });

      this.emit(this.socketGateway.server, {
        ...messageWithEmbeds,
        user: {
          ...messageWithEmbeds.member,
          roles: messageWithEmbeds.member.roles,
        },
        reactions: [],
      } as Message);
    });

    return payload;
  }

  getFileType({ mimetype }: Express.Multer.File): $Enums.FileType {
    const [type] = mimetype.split(';');

    const fileType = Object.values($Enums.FileType).find(
      (fileType: $Enums.FileType) => {
        if (fileType === $Enums.FileType.Gif && type.startsWith('image/gif')) {
          return true;
        }

        return type.startsWith(fileType.toLowerCase());
      },
    );

    if (fileType) {
      return fileType;
    }

    return FileType.Other;
  }

  getFileExtension({ originalname }: Express.Multer.File) {
    return path.extname(originalname).toLowerCase();
  }

  async removeAttachment(attachmentId: number, user: User) {
    const deletedAttachment = await this.prisma.attachment.delete({
      where: {
        id: attachmentId,
        message: {
          member: {
            userId: user.id,
          },
        },
      },
    });

    await unlink(
      path.join(
        process.cwd(),
        'public',
        UploadDestination.Attachments,
        deletedAttachment.name,
      ),
    );

    return deletedAttachment;
  }

  async addReaction(user: Member, { emoji, messageId }: CreateReactionDTO) {
    try {
      const [reaction, count] = await this.prisma.$transaction([
        this.prisma.reaction.create({
          data: {
            messageId,
            memberId: user.id,
            emojiName: emoji.name,
            emojiId: emoji.id,
          },
          include: {
            emoji: {
              select: {
                name: true,
                url: true,
              },
            },
          },
        }),
        this.prisma.reaction.count({
          where: {
            emojiName: emoji.name,
            messageId,
          },
        }),
      ]);

      this.socketGateway.server.emit(SocketEvent.Reaction, {
        count,
        ...reaction,
      });

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async deleteReaction(
    member: Member,
    { emojiName, messageId }: DeleteReactionDTO,
  ) {
    try {
      const [reaction, count] = await this.prisma.$transaction([
        this.prisma.reaction.delete({
          where: {
            messageId_memberId_emojiName: {
              messageId,
              memberId: member.id,
              emojiName,
            },
          },
          include: {
            emoji: {
              select: {
                name: true,
                url: true,
              },
            },
          },
        }),
        this.prisma.reaction.count({
          where: {
            emojiName: emojiName,
            messageId,
          },
        }),
      ]);

      this.socketGateway.server.emit(SocketEvent.Reaction, {
        count,
        ...reaction,
      });

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async deleteMessage(member: Member, messageId: number) {
    try {
      const message = await this.prisma.message.delete({
        where: {
          id: messageId,
        },
        include: {
          channel: {
            select: {
              id: true,
            },
          },
          reactions: {
            include: {
              emoji: true,
            },
          },
          attachments: true,
          member: {
            include: {
              user: true,
              profile: true,
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
      });

      this.emit(this.socketGateway.server, {
        isDeleted: true,
        ...message,
        reactions: [],
        embeds: [],
      } as Message);

      return message;
    } catch (e) {
      console.log(e);
      throw new ForbiddenException();
    }
  }

  async editMessage(
    { id: memberId, user }: Member,
    channelId: number,
    { messageId, message, isPinned }: EditMessageDTO,
  ) {
    const include: Prisma.MessageCreateArgs['include'] = {
      attachments: true,
      channel: {
        select: {
          serverId: true,
        },
      },
      embeds: true,
      member: {
        include: {
          profile: true,
          user: {
            omit: {
              password: true,
              resetPasswordToken: true,
              email: true,
              activateAccountToken: true,
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
    } as const;

    try {
      if (isPinned) {
        const systemMessage = await this.prisma.message.create({
          data: {
            message: '',
            type: $Enums.MessageType.UserPinnedMessage,
            isSystemMessage: true,
            memberId: memberId,
            channelId: channelId,
            messageReferenceId: messageId,
          },
          include: {
            member: include.member,
            channel: include.channel,
          },
        });

        this.emit(this.socketGateway.server, {
          ...systemMessage,
          embeds: [],
          attachments: [],
          reactions: [],
        });
      }

      const data = {
        message,
        isPinned,
        editedAt: message ? new Date() : undefined,
      } as const;

      const messageEntity = await this.prisma.message.update({
        where: {
          id: messageId,
        },
        data,
        include,
      });

      const reactions = await this.getReactions(user, [messageEntity.id]);

      this.emit(this.socketGateway.server, {
        ...messageEntity,
        reactions: reactions[messageEntity.id] || [],
      });

      return {};
    } catch (e) {
      console.log(e);
      throw getHttpException(e);
    }
  }

  async getReactions(user: User, messageIds: number[]) {
    const reactionSelect = {
      select: {
        emoji: {
          select: {
            url: true,
            name: true,
          },
        },
        member: {
          select: {
            userId: true,
          },
        },
        messageId: true,
        emojiName: true,
        id: true,
      },
    } as const;

    const reactions = await this.prisma.reaction.findMany({
      where: { messageId: { in: messageIds } },
      ...reactionSelect,
    });

    return reactions.reduce(
      (reactions, reaction) => {
        const key = reaction.messageId;
        const transformedReactions = reactions[key] || [];
        let transformedReaction = transformedReactions.find(
          ({ emoji: { name } }) => reaction.emojiName === name,
        );

        if (!transformedReaction) {
          const me = reaction.member.userId === user.id;
          const id = me ? reaction.id : undefined;

          transformedReaction = {
            count: 1,
            emoji: { url: reaction.emoji?.url, name: reaction.emojiName },
            me,
            id,
          };

          transformedReactions.push(transformedReaction);

          reactions[key] = transformedReactions;

          return reactions;
        }

        transformedReaction.count += 1;

        return reactions;
      },
      {} as Record<
        string,
        {
          count: number;
          emoji: { url?: string; name: string };
          me: boolean;
          id?: number;
        }[]
      >,
    );
  }

  emit<M extends Message>(websocketServer: Server, payload: M) {
    const { channelId } = payload;

    const room = rooms.channel(channelId);

    websocketServer.to(room).emit(SocketEvent.Message, payload);
  }

  async findAll(options: Prisma.MessageFindManyArgs) {
    return await this.prisma.message.findMany(options);
  }
}
