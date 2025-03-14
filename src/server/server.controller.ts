import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChannelService } from 'src/channel/channel.service';
import { CreateChannelDTO } from 'src/channel/dto/create-channel.dto';
import {
  Permissions,
  PrismaService,
  RequestWithUser,
  ServerPermission,
  SessionGuard,
  UploadDestination,
  exclude,
  getHttpException,
} from 'src/common';
import { validators } from 'src/common/utilities/upload';
import { FfmpegInterceptor } from 'src/common/ffmpeg.interceptor';
import { storage } from 'src/common/multer.storage';
import { ChangeInviteOptionsDTO } from 'src/invitation/dto/change-invite-options';
import { CreateServerDTO } from 'src/server/dto/create-server.dto';
import { ServerService } from 'src/server/server.service';
import { CreateEmojiDTO } from './dto/create-emoji.dto';
import { ManageMemberDTO } from './dto/manage-member.dto';

@Controller('api/servers')
export class ServerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverService: ServerService,
    private readonly channelService: ChannelService,
  ) {}

  @Get('emojis')
  @UseGuards(SessionGuard)
  async getAllEmojis(@Req() { user }: RequestWithUser) {
    const servers = await this.prisma.server.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const emojis = await this.prisma.emoji.findMany({
      where: {
        serverId: {
          in: servers.map(({ id }) => id),
        },
      },
    });

    return emojis;
  }

  @Post()
  @UseGuards(SessionGuard)
  @UseInterceptors(
    FileInterceptor('serverIcon', {
      storage: storage(UploadDestination.ServerIcons),
    }),
    FfmpegInterceptor,
  )
  async create(
    @Body() body: CreateServerDTO,
    @Req() { user }: RequestWithUser,
    @UploadedFile(
      new ParseFilePipe({
        validators,
        fileIsRequired: false,
      }),
    )
    serverIcon?: Express.Multer.File,
  ) {
    return this.serverService.create(body, user, serverIcon);
  }

  @Post(':serverId/channels')
  @HttpCode(HttpStatus.CREATED)
  @Permissions([ServerPermission.ManageChannels])
  createChannel(
    @Body() createChannelDTO: CreateChannelDTO,
    @Req() { user }: RequestWithUser,
  ) {
    return this.channelService.create(createChannelDTO, user);
  }

  @Get(':serverId/channels')
  @UseGuards(SessionGuard)
  getChannels(
    @Param('serverId', ParseIntPipe) serverId: number,
    @Req() { user }: RequestWithUser,
  ) {
    return this.serverService.getChannels(serverId, user);
  }

  @Delete(':serverId(\\d+)')
  @Permissions([ServerPermission.ManageServer])
  delete(@Param('serverId', ParseIntPipe) serverId: number) {
    return this.serverService.delete(serverId);
  }

  @Get(':inviteId')
  @UseGuards(SessionGuard)
  async getServerByInviteId(@Param('inviteId') inviteId: string) {
    return this.serverService.getServerByInviteId(inviteId);
  }

  @Get(':serverId/members')
  @Permissions([ServerPermission.Member])
  async getServerMembers(@Param('serverId', ParseIntPipe) serverId: number) {
    const members = await this.prisma.member.findMany({
      where: {
        AND: [
          {
            serverId,
          },
          {
            isBanned: false,
          },
        ],
      },
      include: {
        user: true,
      },
    });

    return members.map((member) => ({
      ...member,
      user: exclude(member.user, ['password', 'email', 'resetPasswordToken']),
    }));
  }

  @Post(':serverId(\\d+)/members')
  createMember(
    @Param('serverId', ParseIntPipe) serverId: number,
    @Req() { user }: RequestWithUser,
  ) {
    return this.serverService.createMember(serverId, user);
  }

  @Patch('invite')
  @Permissions([ServerPermission.Invite])
  async changeInviteOpions(
    @Body() { expiresIn, numberOfUses, serverId }: ChangeInviteOptionsDTO,
  ) {
    try {
      const invite = await this.prisma.inviteLink.update({
        where: {
          serverId,
        },
        data: {
          expiration: expiresIn,
          numberOfUses,
        },
      });

      return {
        expiresIn: invite.expiration,
        numberOfUses: invite.numberOfUses,
      };
    } catch (e) {
      throw getHttpException(e);
    }
  }

  @Delete(':serverId(\\d+)/members')
  @UseGuards(SessionGuard)
  leaveServer(
    @Req() { user }: RequestWithUser,
    @Param('serverId', ParseIntPipe) serverId: number,
  ) {
    return this.serverService.leaveServer(user, serverId);
  }

  @Patch(':serverId(\\d+)/members')
  @Permissions([ServerPermission.ManageMembers])
  async editMember(@Body() { memberId, isBanned, isKicked }: ManageMemberDTO) {
    try {
      if (isBanned) {
        await this.serverService.banMember(memberId);
      }

      if (isKicked) {
        await this.serverService.kickMember(memberId);
      }

      return {};
    } catch (e) {
      throw getHttpException(e);
    }
  }

  @Post(':serverId(\\d+)/emojis')
  @Permissions([ServerPermission.ManageServer])
  @UseInterceptors(
    FileInterceptor('emoji', { storage: storage(UploadDestination.Emojis) }),
    FfmpegInterceptor,
  )
  async createEmoji(
    @Body() createEmojiDTO: CreateEmojiDTO,
    @Param('serverId', ParseIntPipe) serverId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators,
      }),
    )
    emoji: Express.Multer.File,
  ) {
    return this.serverService.createEmoji(createEmojiDTO, serverId, emoji);
  }

  @Get(':serverId(\\d+)/emojis')
  @Permissions([ServerPermission.Member])
  async getEmojis(@Param('serverId', ParseIntPipe) serverId: number) {
    return await this.prisma.emoji.findMany({
      where: {
        serverId,
      },
    });
  }
}
