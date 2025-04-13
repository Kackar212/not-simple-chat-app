import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { $Enums, Prisma, Status, User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { differenceInMinutes, format } from 'date-fns';
import {
  HASH_ROUNDS,
  PrismaService,
  ServerEntity,
  UploadDestination,
  getFileUrl,
  getHttpException,
  rooms,
  SocketEvent,
  ErrorCode,
  UserWithoutPrivateData,
  userPayload,
} from 'src/common';
import { SocketGateway } from 'src/common/socket/socket.gateway';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { MessageService } from 'src/message/message.service';
import { ServerService } from 'src/server/server.service';
import { AddRoleDTO } from 'src/user/dto/add-role.dto';
import { ResetPasswordDTO } from 'src/user/dto/reset-password.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { Member } from 'src/server/server.types';
import path from 'path';
import { PRISMA_INJECTION_TOKEN } from 'src/common/prisma/prisma.module';

@Injectable()
export class UserService {
  constructor(
    @Inject(PRISMA_INJECTION_TOKEN)
    private readonly prisma: PrismaService,
    private readonly messageService: MessageService,
    private readonly directMessageService: DirectMessageService,
    private readonly websocketGateway: SocketGateway,
    private readonly configService: ConfigService,
    private readonly serverService: ServerService,
  ) {}

  async updateUser(
    userData: UpdateUserDTO,
    user: User,
    avatar?: Express.Multer.File,
  ) {
    if (userData.isInvisible && userData.status) {
      throw new BadRequestException({
        code: ErrorCode.BadRequestException,
        message:
          'Specify only isInvisible or status, not both at the same time',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const { status: specialStatus = user.specialStatus, isInvisible } =
      userData;

    const { profileId } = userData;

    const data: Prisma.UserUpdateArgs['data'] = {
      isInvisible,
      status: Status.Online,
      specialStatus: !specialStatus ? null : specialStatus,
    };

    if (isInvisible) {
      data.status = Status.Offline;
    }

    if (avatar) {
      data.avatar = new URL(
        path.join(UploadDestination.Avatars, avatar.filename),
        process.env.APP_URL,
      ).toString();
    }

    try {
      await this.prisma.serverProfile.update({
        where: {
          id: profileId,
          member: {
            userId: user.id,
          },
        },
        data,
      });

      const updatedUser = await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data,
        omit: {
          password: true,
          resetPasswordToken: true,
          email: true,
          activateAccountToken: true,
          activationTokenExpiresIn: true,
          isAccountActive: true,
        },
      });

      const statusRooms =
        await this.websocketGateway.getStatusRooms(updatedUser);

      if (statusRooms) {
        this.websocketGateway.server
          .to([...statusRooms, rooms.privateRoom(user.username)])
          .emit(SocketEvent.Status, updatedUser);
      }
    } catch (e) {
      throw getHttpException(e);
    }

    return {};
  }

  async changeAvatar(user: User, avatar: Express.Multer.File) {
    this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        avatar: getFileUrl(UploadDestination.Avatars, avatar.filename),
      },
    });
  }

  async invite({
    server,
    member,
    username,
  }: {
    username: string;
    server: ServerEntity;
    member: Member<{
      include: { user: userPayload };
      omit: never;
      select: never;
    }>;
  }) {
    const { inviteLink } = server;

    const invitedUser = await this.prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (!invitedUser) {
      throw new NotFoundException();
    }

    const globalServer = await this.prisma.server.findUnique({
      where: {
        name_ownerName: {
          name: this.configService.get('GLOBAL_SERVER_NAME')!,
          ownerName: this.configService.get('SYSTEM_ACCOUNT_NAME')!,
        },
      },
    });

    try {
      const channel = await this.directMessageService.findOrCreate({
        username,
        member,
        serverId: globalServer!.id,
      });

      const { id: channelId } = channel;

      const newMessage = await this.messageService.create(
        {
          member,
          message: inviteLink!.url,
          type: $Enums.MessageType.ServerInvitation,
          channelId,
        },
        [],
      );

      this.websocketGateway.server
        .to(rooms.privateRoom(username))
        .emit(SocketEvent.DirectMessageChannel, channel);

      this.messageService.emit(this.websocketGateway.server, newMessage);

      return channel;
    } catch (e) {
      console.error(e);
      throw getHttpException(e);
    }
  }

  async resetPassword(
    { oldPassword, newPassword }: ResetPasswordDTO,
    user: User,
  ) {
    try {
      const isOldPasswordCorrect = await compare(oldPassword, user.password);

      if (!isOldPasswordCorrect) {
        throw new BadRequestException({
          code: ErrorCode.IncorrectOldPassword,
          message: 'Old password is incorrect!',
          statusCode: HttpStatus.BAD_REQUEST,
        });
      }

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: await hash(newPassword, HASH_ROUNDS),
          resetPasswordToken: null,
        },
      });

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async getBlacklist(user: User) {
    const blacklist = await this.prisma.blacklist.findMany({
      where: {
        blacklistOwnerUsername: user.username,
      },
      include: {
        blocked: {
          select: {
            id: true,
            avatar: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return blacklist;
  }

  async getRoles(serverId: number, user: User) {
    const roles = await this.prisma.userRole.findMany({
      where: {
        AND: [{ member: { userId: user.id } }],
      },
    });

    return roles;
  }

  async addRole({ roleName, serverId, userId: memberId }: AddRoleDTO) {
    try {
      return await this.prisma.userRole.create({
        data: {
          role: {
            connect: {
              name_serverId: { name: roleName, serverId },
            },
          },
          member: {
            connect: {
              id: memberId,
            },
          },
        },
      });
    } catch (e) {
      throw getHttpException(e);
    }
  }

  async getServers(user: User) {
    const servers = await this.prisma.server.findMany({
      where: {
        members: { some: { AND: [{ userId: user.id }, { isBanned: false }] } },
        isGlobalServer: null,
      },
      include: {
        channels: {
          take: 1,
        },
      },
    });

    console.log(servers);

    return servers.map((server) => ({
      ...server,
      defaultChannel: server.channels[0],
    }));
  }

  async getServer(user: User, serverId?: number) {
    if (!serverId) {
      return this.serverService.getGlobalServer({});
    }

    const server = await this.prisma.server.findUnique({
      where: {
        id: serverId,
        AND: [
          {
            members: {
              some: {
                userId: user.id,
              },
            },
          },
          { isGlobalServer: null },
        ],
      },
      include: {
        inviteLink: true,
        members: {
          where: {
            isBanned: false,
          },
          include: {
            profile: true,
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
          },
        },
        roles: true,
      },
    });

    if (!server) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Server does not exists',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const members = server.members.map((member) => ({
      ...member,
      user: member.user,
    }));

    const member = members.find(({ userId }) => {
      return user.id === userId;
    });

    if (!member) {
      throw new ForbiddenException({
        code: ErrorCode.UserBanned,
        message: `You have been banned in this server!`,
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    const hasPunshimentExpired = (date: Date | null) =>
      differenceInMinutes(new Date(), date || new Date()) > 0;

    if (member.isKickedOut && !hasPunshimentExpired(member.kickedOutUntil)) {
      throw new ForbiddenException({
        code: ErrorCode.UserKicked,
        message: `You have been kicked out of this server until ${format(member.kickedOutUntil!, 'h:m a')}`,
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    return {
      ...server,
      members: members.map((member) => ({
        ...member,
        isKickedOut:
          member.isKickedOut && !hasPunshimentExpired(member.kickedOutUntil),
        kickedOutUntil: hasPunshimentExpired(member.kickedOutUntil)
          ? null
          : member.kickedOutUntil,
      })),
      member,
      defaultChannel: server.channels[0],
    };
  }

  async #getServerId(serverId: number) {
    if (serverId !== -1) {
      return serverId;
    }

    const server = await this.serverService.getGlobalServer({
      select: { id: true },
    });

    return server.id;
  }

  async getMemberProfile(
    user: User,
    profile: { serverId: number; userId: number },
  ) {
    const { userId: mutualWith } = profile;
    const isCurrentUser = user.id === mutualWith;

    const serverId = await this.#getServerId(profile.serverId);

    const member = await this.prisma.member.findUnique({
      where: {
        serverId_userId: {
          userId: mutualWith,
          serverId,
        },
      },
      include: {
        user: true,
        profile: true,
        roles: {
          where: {
            roleName: {
              not: 'everyone',
            },
          },
          select: {
            role: {
              select: {
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Member not found',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    console.log({
      friendName: user.username,
      hostUsername: member.user.username,
    });
    const privateChannel = isCurrentUser
      ? null
      : await this.prisma.channel.findFirst({
          where: {
            name: {
              hasEvery: [user.username, member.user.username],
            },
            server: {
              isGlobalServer: true,
            },
          },
          select: {
            id: true,
          },
        });

    const isBlocked = Boolean(
      await this.prisma.blacklist.findUnique({
        where: {
          blockedUsername_blacklistOwnerUsername: {
            blockedUsername: member.user.username,
            blacklistOwnerUsername: user.username,
          },
        },
      }),
    );

    const friend = isCurrentUser
      ? null
      : await this.prisma.friend.findUnique({
          where: {
            friendName_username: {
              friendName: user.username,
              username: member.user.username,
            },
          },
          select: {
            id: true,
            isPending: true,
            isInvited: true,
            privateChannelId: true,
          },
        });

    const mutualData = isCurrentUser
      ? { mutualFriends: [], mutualServers: [] }
      : await this.getMutual(user, mutualWith);

    const hasFriendRequest = !isCurrentUser && !!friend?.isPending;

    const permissions = await this.prisma.permission.findMany({
      where: {
        role: {
          members: {
            some: {
              memberId: member.id,
            },
          },
        },
      },
    });

    console.log(permissions);

    return {
      ...mutualData,
      user: {
        ...member.user,
        ...member.profile,
        roles: member.roles.map((role) => role.role),
        joinedServerAt: member.createdAt,
        isOwner: member.isOwner,
        isBlocked,
      },
      isFriend: !isCurrentUser && !!friend && !friend.isPending,
      hasFriendRequest,
      isInvited: !isCurrentUser && !friend?.isInvited && hasFriendRequest,
      friend: privateChannel
        ? { ...friend, privateChannelId: privateChannel?.id }
        : friend,
    };
  }

  getMutualFriendsCount(username: string, user: User) {
    return this.prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) 
    FROM public."Friend" AS v1
    INNER JOIN public."Friend" AS v2 ON (v1."friendName" = v2."friendName") 
    WHERE v2."username" = ${username} AND v1."username" = ${user.username}`;
  }

  public async getMutual(
    user: User,
    mutualWith: number,
    onlyCount: boolean = false,
  ) {
    const u = await this.prisma.user.findUnique({ where: { id: mutualWith } });
    const [{ count }] = await this.getMutualFriendsCount(u!.username, user);

    const friends = await this.prisma.friend.findMany({
      where: {
        OR: [
          {
            friend: {
              id: user.id,
            },
          },
          { friend: { id: mutualWith } },
        ],
        user: {
          id: {
            notIn: [mutualWith, user.id],
          },
        },
        isPending: false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true && !onlyCount,
            avatar: true && !onlyCount,
            status: true && !onlyCount,
            displayName: true && !onlyCount,
          },
        },
        friend: {
          select: {
            id: true,
          },
        },
      },
    });

    const mutualFriends = friends.filter(({ friendName }) => {
      return user.username === friendName;
    });

    const mutualServers = await this.prisma.server.findMany({
      where: {
        AND: [
          {
            AND: [
              {
                members: {
                  some: {
                    userId: mutualWith,
                    isBanned: false,
                  },
                },
              },
              {
                members: {
                  some: {
                    userId: user.id,
                  },
                },
              },
            ],
          },
          {
            isGlobalServer: {
              equals: null,
            },
          },
        ],
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
        channels: {
          take: 1,
        },
        members: {
          where: {
            userId: mutualWith,
          },
          include: {
            profile: true,
          },
        },
      },
    });

    return {
      mutualFriends,
      mutualServers,
      count: Number(count.toString()),
    };
  }

  public async getEmojis(user: User) {
    return this.prisma.emoji.findMany({
      where: {
        server: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    });
  }

  async updateProfile(
    {
      id,
      profile,
    }: Member<{
      include: {
        user: {
          omit: {
            isAccountActive: true;
            password: true;
            resetPasswordToken: true;
            activateAccountToken: true;
            activationTokenExpiresIn: true;
            email: true;
            isInvisible: true;
          };
        };
        profile: true;
      };
      omit: never;
      select: never;
    }>,
    shouldSetState: boolean,
  ) {
    if (!shouldSetState) {
      return profile;
    }

    return await this.prisma.serverProfile.update({
      where: {
        memberId: id,
      },
      data: {
        status: Status.Online,
      },
    });
  }

  public async getUser(user: User, serverId: number) {
    let id = serverId;
    const isGlobalServer = id === -1;

    if (id === -1) {
      const globalServer = await this.getServer(user);

      id = globalServer.id;
    }

    const member = await this.getMember(id, user.id);

    if (!member) {
      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message:
          'There is no member in this server associated with this user id',
        statusCode: 404,
      });
    }

    const shouldSetStatus = !user.isInvisible && user.status === Status.Offline;
    const updatedUser = await this.updateProfile(member, shouldSetStatus);

    const rooms = await this.websocketGateway.getStatusRooms(
      member.user,
      serverId,
    );

    if (rooms) {
      this.websocketGateway.server
        .to(rooms)
        .emit(SocketEvent.Status, { ...user, ...updatedUser });
    }

    const blacklist = await this.getBlacklist(user);
    const emojis = await this.getEmojis(user);
    const pendingFriendsCount = await this.prisma.friend.count({
      where: {
        username: user.username,
        isPending: true,
      },
    });

    const profile = {
      ...member.profile,
      serverId: isGlobalServer ? undefined : serverId,
      username: user.username,
    };

    if (serverId === -1) {
      return {
        member: {
          ...member,
          serverId: undefined,
          profile,
        },
        user: member.user,
        blacklist,
        emojis,
        pendingFriends: pendingFriendsCount,
      };
    }

    return {
      member: {
        ...member,
        profile,
        user: member.user,
      },
      user: member.user,
      blacklist,
      emojis,
      pendingFriends: pendingFriendsCount,
    };
  }

  public getMember(serverId: number, userId: number) {
    return this.prisma.member.findUnique({
      where: {
        serverId_userId: {
          serverId,
          userId,
        },
      },
      include: {
        profile: true,
        user: {
          omit: {
            isInvisible: false,
          },
        },
        roles: {
          select: {
            role: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
  }
}
