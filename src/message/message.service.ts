import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  $Enums,
  FileType,
  Message,
  PollType,
  Prisma,
  User,
} from '@prisma/client';
import {
  ErrorCode,
  Member,
  PrismaService,
  SocketEvent,
  UploadDestination,
  UserWithoutPrivateData,
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
import * as linkify from 'linkifyjs';
import { CreatePollDTO } from './dto/create-poll.dto';
import { CreateUserAnswerDTO } from './dto/create-answer.dto';
import { PRISMA_INJECTION_TOKEN } from 'src/common/prisma/prisma.module';
import path from 'path';
import 'linkify-plugin-mention';
import { RemoveAnswerDTO } from './dto/remove-answer.dto';

interface CreateMessage extends CreateMessageDTO {
  member: Member;
}

@Injectable()
export class MessageService {
  constructor(
    @Inject(PRISMA_INJECTION_TOKEN)
    private readonly prisma: PrismaService,
    private readonly embedService: EmbedService,
    private readonly socketGateway: SocketGateway,
    private readonly directMessageService: DirectMessageService,
  ) {}

  async create(
    { message, channelId, member, type, replyTo }: CreateMessage,
    attachments: Express.Multer.File[],
    createPollDTO?: CreatePollDTO,
  ) {
    const links = linkify
      .find(message, 'url', { defaultProtocol: 'https' })
      .slice(0, 5);

    const rawMentions = [
      ...message.matchAll(/<@&?!?(\d+?)>|(@(?:everyone|here))/g),
    ];

    const { roles, members, mentionEveryone, mentionHere } = rawMentions.reduce(
      (mentions, [mention, id]) => {
        const isRole = mention.startsWith('<@&');
        const isStatic = mention === '@everyone' || mention === '@here';
        const mentionEveryone = mentions.mentionEveryone
          ? mentions.mentionEveryone
          : mention === '@everyone';
        const mentionHere = mentions.mentionHere
          ? mentions.mentionHere
          : mention === '@here';

        if (isRole) {
          mentions.roles.add(Number(id));
        }

        if (!isRole && !isStatic) {
          mentions.members.add(Number(id));
        }

        return {
          ...mentions,
          mentionEveryone,
          mentionHere,
        };
      },
      {
        roles: new Set<number>(),
        members: new Set<number>(),
        mentionEveryone: false,
        mentionHere: false,
      },
    );

    // console.log(roles, members, mentionEveryone, mentionHere);

    // const mentions = await this.prisma.member.findMany({
    //   where: {
    //     id: {
    //       in: [...members],
    //     },
    //   },
    // });

    // const mentionRoles = await this.prisma.role.findMany({
    //   where: {
    //     id: {
    //       in: [...roles],
    //     },
    //   },
    // });

    const include = {
      embeds: {
        select: {
          embed: true,
        },
      },
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
      mentions: true,
      mentionRoles: true,
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

    let createPollData:
      | Prisma.PollUncheckedCreateNestedOneWithoutMessageInput
      | undefined = undefined;

    if (createPollDTO) {
      createPollData = {
        create: {
          type: createPollDTO.type,
          question: createPollDTO.question,
          answers: {
            createMany: {
              data: createPollDTO.answers.map(
                ({ answer, isCorrectAnswer }) => ({
                  answer,
                  isCorrectAnswer:
                    createPollDTO.type === PollType.Quiz
                      ? !!isCorrectAnswer
                      : false,
                }),
              ),
            },
          },
        },
      } as const;
    }

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
              isVoiceClip:
                file.originalname.startsWith('__VOICECLIP__') &&
                file.mimetype.startsWith('audio/'),
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
        poll: createPollData,
        mentionRoles: {
          createMany: {
            data: [...roles].map((roleId) => ({ roleId })),
          },
        },
        mentions: {
          createMany: {
            data: [...members].map((memberId) => ({ memberId })),
          },
        },
        mentionEveryone: mentionEveryone || mentionHere,
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
    try {
      const deletedAttachment = await this.prisma.attachment.delete({
        where: {
          id: attachmentId,
          message: {
            member: {
              userId: user.id,
            },
          },
        },
        include: {
          message: {
            select: {
              id: true,
              attachments: true,
              message: true,
              channelId: true,
            },
          },
        },
      });

      const {
        message: { id, message, attachments },
      } = deletedAttachment;

      const hasAttachments =
        attachments.filter(({ id }) => id !== attachmentId).length > 0;

      await unlink(
        path.join(
          process.cwd(),
          'public',
          UploadDestination.Attachments,
          deletedAttachment.name,
        ),
      );

      if (!hasAttachments && message === '') {
        this.deleteMessage(id);
      }

      return deletedAttachment;
    } catch (e) {
      throw getHttpException(e);
    }
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

  async deleteMessage(messageId: number) {
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
        poll: null,
      } as Message);

      return message;
    } catch (e) {
      throw getHttpException(e);
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
          poll: null,
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

  async getReactions(user: UserWithoutPrivateData, messageIds: number[]) {
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

  async createPoll(createPollDto: CreatePollDTO, member: Member) {
    await this.create(
      { message: '', channelId: createPollDto.channelId, member },
      [],
      createPollDto,
    );

    return {};
  }

  async createUserAnswer(
    { messageId, answerId }: CreateUserAnswerDTO,
    userId: number,
  ) {
    const poll = await this.prisma.poll.findUnique({
      where: {
        messageId,
        answers: {
          some: {
            id: answerId,
          },
        },
      },
      select: { id: true, message: { select: { channelId: true } } },
    });

    if (!poll) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Poll does not exists',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    try {
      const answer = await this.prisma.pollUserAnswer.create({
        data: {
          pollId: poll.id,
          pollAnswerId: answerId,
          userId,
        },
        include: {
          pollAnswer: true,
        },
      });

      this.socketGateway.server
        .to(rooms.channel(poll.message.channelId))
        .emit(SocketEvent.PollAnswer, { ...answer, messageId });

      return answer;
    } catch (e) {
      throw getHttpException(e);
    }
  }

  public async removeUserAnswer(
    { answerId, messageId }: RemoveAnswerDTO,
    userId: number,
  ) {
    const poll = await this.prisma.poll.findUnique({
      where: {
        messageId,
        answers: {
          some: {
            id: answerId,
          },
        },
      },
      select: { id: true, message: { select: { channelId: true } } },
    });

    if (!poll) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Poll does not exists',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    try {
      const answer = await this.prisma.pollUserAnswer.delete({
        where: {
          userId_pollId: {
            pollId: poll.id,
            userId,
          },
        },
        include: {
          pollAnswer: true,
        },
      });

      this.socketGateway.server
        .to(rooms.channel(poll.message.channelId))
        .emit(SocketEvent.PollAnswer, {
          ...answer,
          messageId,
          isDeleted: true,
        });

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }
}
