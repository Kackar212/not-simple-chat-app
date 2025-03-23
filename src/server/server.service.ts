import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCode,
  Limit,
  PrismaService,
  ServerPermission,
  SocketEvent,
  UploadDestination,
  User,
  createPlaceholder,
  exclude,
  getHttpException,
  rooms,
} from 'src/common';
import { CreateServerDTO } from 'src/server/dto/create-server.dto';
import { CreateRoleDTO } from 'src/server/dto/create-role.dto';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { Prisma, Status } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { CreateEmojiDTO } from './dto/create-emoji.dto';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import path from 'path';
import { FindMember, Member } from './server.types';

@Injectable()
export class ServerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: SocketGateway,
    private readonly configService: ConfigService,
  ) {}

  getInviteId() {
    return Buffer.from(crypto.getRandomValues(new Uint32Array(32)))
      .toString('base64url')
      .substring(0, 12);
  }

  async getChannels(serverId: number, user: User) {
    const channels = await this.prisma.channel.findMany({
      where: {
        AND: [
          { id: serverId },
          {
            server: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    });

    return channels;
  }

  async getGeneratedIconData(name: string) {
    const words = name.split(' ');

    let firstWord = words.at(0) || '';
    const lastWordFirstLetter = words.at(-1)?.at(0) || '';

    const [firstLetter, ...rest] = [...firstWord];
    firstWord = [firstLetter.toUpperCase(), ...rest].join('');

    const text = firstWord?.substring(0, 2) + lastWordFirstLetter.toUpperCase();

    const fileName = path.join(
      UploadDestination.ServerIcons,
      `${randomUUID()}.png`,
    );
    const fullFilePath = path.join(process.cwd(), 'public', fileName);

    Buffer.from(`<svg><text>${text}</text></svg>`);

    const file = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: 'rgb(0, 0, 0)',
      },
    })
      .composite([{ input: { text: { text } }, left: 32, top: 32 }])
      .png()
      .toBuffer();

    await writeFile(fullFilePath, file, { flag: 'w' });

    return {
      fullPath: fullFilePath,
      urlPath: fileName,
    };
  }

  async getServerIconFileData(serverIcon?: Express.Multer.File) {
    if (!serverIcon) {
      return;
    }

    const urlPath = path.join(
      UploadDestination.ServerIcons,
      serverIcon.filename,
    );

    const fullPath = path.join(process.cwd(), 'public', urlPath);

    const url = new URL(urlPath, process.env.APP_URL);
    const placeholder = await createPlaceholder(fullPath);

    return {
      url: url.toString(),
      placeholder,
    };
  }

  async create(
    { name }: CreateServerDTO,
    user: User,
    serverIcon?: Express.Multer.File,
  ) {
    const inviteId = this.getInviteId();

    const iconData = await this.getServerIconFileData(serverIcon);

    const inviteUrl = new URL(
      `invite/${inviteId}`,
      process.env.CLIENT_URL,
    ).toString();

    try {
      const server = await this.prisma.server.create({
        data: {
          name,
          ownerName: user.username,
          ownerId: user.id,
          serverIcon: iconData?.url,
          iconPlaceholder: iconData?.placeholder,
          inviteLink: {
            create: {
              inviteId,
              url: inviteUrl,
            },
          },
          channels: {
            create: {
              name: ['general'],
              createdBy: user.username,
            },
          },
          roles: {
            create: {
              name: 'everyone',
              permissions: {
                createMany: {
                  data: [
                    {
                      isAllowed: true,
                      permission: ServerPermission.Read,
                    },
                    {
                      isAllowed: true,
                      permission: ServerPermission.Write,
                    },
                  ],
                },
              },
            },
          },
        },
        include: {
          channels: {
            take: 1,
          },
        },
      });

      await this.prisma.member.create({
        data: {
          userId: user.id,
          serverId: server.id,
          isOwner: true,
          profile: {
            create: {
              ...exclude(user, [
                'id',
                'password',
                'email',
                'resetPasswordToken',
                'username',
                'createdAt',
                'updatedAt',
                'activateAccountToken',
                'isAccountActive',
                'activationTokenExpiresIn',
              ]),
              serverId: server.id,
            },
          },
        },
      });

      return { ...server, defaultChannel: server.channels[0] };
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async delete(serverId: number) {
    try {
      return this.prisma.server.delete({
        where: {
          id: serverId,
        },
      });
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async getServerByInviteId(inviteId: string) {
    const server = await this.prisma.server.findFirst({
      where: {
        inviteLink: {
          inviteId: decodeURI(inviteId),
        },
      },
      include: {
        members: {
          select: {
            profile: {
              select: {
                status: true,
              },
            },
          },
        },
        channels: {
          take: 1,
        },
      },
    });

    if (!server) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Invite with this is does not exists',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const membersCount = server.members.length;
    const offlineMembersCount = server.members.filter(
      ({ profile }) => profile?.status === Status.Offline,
    ).length;

    const onlineMembersCount = membersCount - offlineMembersCount;

    return {
      ...server,
      membersCount,
      onlineMembersCount,
      offlineMembersCount,
      defaultChannel: server?.channels[0],
    };
  }

  async getChannel(user: User, channelId: number) {
    const channel = await this.prisma.channel.findUnique({
      where: {
        id: channelId,
        server: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      },
      include: {
        server: {},
        messages: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    displayName: true,
                    avatar: true,
                    username: true,
                    id: true,
                  },
                },
              },
            },
          },
          take: 50,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return {
      data: channel,
    };
  }

  async createRole({ allowed, denied, name, serverId }: CreateRoleDTO) {
    try {
      return await this.prisma.role.create({
        data: {
          serverId,
          name,
          permissions: {
            createMany: {
              data: [
                ...allowed.map((permission) => ({
                  permission,
                  isAllowed: true,
                })),
                ...denied.map((permission) => ({
                  permission,
                  isAllowed: false,
                })),
              ],
            },
          },
        },
        select: {
          name: true,
          permissions: true,
        },
      });
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async getServer(user: User, serverId: number, channelId?: number) {
    const server = await this.prisma.server.findUnique({
      where: {
        id: serverId,
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: true,
                  },
                },
              },
            },
            user: true,
          },
          take: 50,
        },
        channels: {
          include: {
            channelUsers: true,
            messages: {
              include: {
                member: { include: { user: true } },
              },
              where: {
                channelId,
              },
            },
          },
        },
      },
    });
    if (!server) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'This server does not exists',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return {
      ...server,
      defaultChannel: server.channels[0],
    };
  }

  async createMember(serverId: number, user: User) {
    const membersCount = await this.prisma.member.count({
      where: {
        serverId,
      },
    });

    if (membersCount === Limit.Members) {
      throw new ForbiddenException({
        code: ErrorCode.LimitReached,
        message: 'Limit reached',
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    try {
      const member = await this.prisma.member.create({
        data: {
          userId: user.id,
          serverId,
          roles: {
            create: {
              roleName: 'everyone',
              roleServerId: serverId,
            },
          },
          profile: {
            create: {
              serverId,
              avatar: user.avatar,
              backgroundColor: user.backgroundColor,
              backgroundImage: user.backgroundImage,
              description: user.description,
              displayName: user.displayName,
              status: user.status,
            },
          },
        },
        include: {
          server: {
            select: {
              channels: {
                take: 1,
              },
            },
          },
        },
      });

      const {
        server: {
          channels: [channel],
        },
      } = member;

      this.websocketGateway.server
        .to(rooms.channel(channel.id))
        .emit('member', member);

      return member;
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async getGlobalServer<
    Find extends Omit<Prisma.ServerFindUniqueArgs, 'where'> = Omit<
      Prisma.ServerFindUniqueArgs,
      'where'
    >,
  >(findOptions: Find) {
    const server = await this.prisma.server.findUnique({
      ...findOptions,
      where: {
        isGlobalServer: true,
      },
    });

    if (!server) {
      throw new Error('There is no global server!');
    }

    return server as Prisma.ServerGetPayload<{
      select: Find['select'];
      include: Find['include'];
    }>;
  }

  async getGlobalServerMembers<
    S extends Prisma.MemberSelect = never,
    I extends Prisma.MemberInclude = never,
    O extends Prisma.MemberOmit = never,
  >(findOptions: FindMember<S, I, O>) {
    const members = await this.prisma.member.findMany({
      ...findOptions,
      where: {
        ...findOptions?.where,
        server: {
          isGlobalServer: true,
        },
      },
    });

    return members as Member<{ select: S; include: I; omit: O }>[];
  }

  async getGlobalServerMember<
    S extends Prisma.MemberSelect = never,
    I extends Prisma.MemberInclude = never,
    O extends Prisma.MemberOmit = never,
  >(findOptions: FindMember<S, I, O>) {
    const member = await this.prisma.member.findFirst({
      ...findOptions,
      where: {
        ...findOptions?.where,
        server: {
          isGlobalServer: true,
        },
      },
    });

    return member as Member<{ select: S; include: I; omit: O }>;
  }

  async leaveServer(user: User, serverId: number) {
    try {
      const member = await this.prisma.member.delete({
        where: {
          serverId_userId: {
            serverId,
            userId: user.id,
          },
          isOwner: false,
          isBanned: false,
          isKickedOut: false,
        },
      });

      this.websocketGateway.server
        .to(user.username)
        .emit(SocketEvent.LeaveServer);

      return member;
    } catch (e) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You cant leave this server!',
      });
    }
  }

  async banMember(memberId: number) {
    const member = await this.prisma.member.update({
      where: {
        id: memberId,
        isOwner: false,
      },
      data: {
        isBanned: true,
        isKickedOut: false,
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    this.websocketGateway.server
      .to(rooms.privateRoom(member.user.username))
      .emit(SocketEvent.Punished, { type: 'ban', serverId: member.serverId });
  }

  async kickMember(memberId: number) {
    const member = await this.prisma.member.update({
      where: {
        id: memberId,
        isOwner: false,
      },
      data: {
        isKickedOut: true,
        kickedOutUntil: new Date(Date.now() + 30 * 60 * 1000),
        kickedOutCount: {
          increment: 1,
        },
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });
    console.log(member);

    this.websocketGateway.server
      .to(rooms.privateRoom(member.user.username))
      .emit(SocketEvent.Punished, { type: 'kick', serverId: member.serverId });
  }

  async createEmoji(
    { name, scope }: CreateEmojiDTO,
    serverId: number,
    emoji: Express.Multer.File,
  ) {
    try {
      const emojisCount = await this.prisma.emoji.count({
        where: {
          serverId,
        },
      });

      if (emojisCount === Limit.Emojis) {
        throw new ForbiddenException({
          code: ErrorCode.LimitReached,
          message: 'Limit reached!',
          statusCode: HttpStatus.FORBIDDEN,
        });
      }

      const emojiUrl = new URL(
        `${UploadDestination.Emojis}/${emoji.filename}`,
        process.env.APP_URL,
      );

      const placeholder = await createPlaceholder(emoji.path);

      const newEmoji = await this.prisma.emoji.create({
        data: {
          name: name.replaceAll(/_+/g, '_'),
          url: emojiUrl.toString(),
          scope,
          serverId,
          placeholder,
        },
      });

      this.websocketGateway.server
        .to(rooms.server(serverId))
        .emit(SocketEvent.Emoji, newEmoji);

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }
}
