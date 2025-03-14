import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ChannelPermission,
  ErrorCode,
  Permissions,
  RequestWithUser,
  SessionGuard,
} from 'src/common';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { CreateDirectMessageChannelDTO } from 'src/direct-message/dto/create-direct-message-channel.dto';
import { ServerService } from 'src/server/server.service';

@Controller('api/direct-message')
export class DirectMessageController {
  constructor(
    private readonly directMessageService: DirectMessageService,
    private readonly serverService: ServerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard)
  async create(
    @Body() dto: CreateDirectMessageChannelDTO,
    @Req() { user }: RequestWithUser,
  ) {
    const member = await this.serverService.getGlobalServerMember({
      where: { userId: user.id },
      include: { user: true },
    });

    if (!member) {
      Logger.fatal(
        'User exists but corresponding member in global server does not exists!',
      );

      throw new NotFoundException({
        code: ErrorCode.NotFound,
        message: 'Member does not exist',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    await this.directMessageService.create(member, dto);

    return {};
  }

  @Get()
  @UseGuards(SessionGuard)
  getAll(@Req() { user }: RequestWithUser) {
    return this.directMessageService.getAll(user);
  }

  @Get(':channelId')
  @Permissions([ChannelPermission.Read])
  get(
    @Req() { member }: RequestWithUser,
    @Param('channelId', ParseIntPipe) channelId: number,
  ) {
    return this.directMessageService.get(member, channelId);
  }

  @Patch()
  @Permissions([ChannelPermission.Read])
  accept(
    @Body() { channelId, messageId }: { channelId: number; messageId: number },
    @Req() { user }: RequestWithUser,
  ) {
    return this.directMessageService.accept(channelId, messageId, user);
  }

  @Delete()
  delete(
    @Body() { channelId, messageId }: { channelId: number; messageId: number },
    @Req() { user }: RequestWithUser,
  ) {
    return this.directMessageService.delete(channelId, messageId, user);
  }
}
