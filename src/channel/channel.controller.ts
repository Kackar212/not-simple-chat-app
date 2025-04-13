import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ChannelService } from './channel.service';
import { PermissionsDTO } from 'src/channel/dto/permissions.dto';
import {
  Channel,
  ChannelEntity,
  ChannelPermission,
  ErrorCode,
  Permissions,
  RequestWithUser,
  ServerPermission,
  SessionGuard,
  UploadDestination,
} from 'src/common';
import { CreateMessageDTO } from 'src/message/dto/create-message.dto';
import { MessageService } from 'src/message/message.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { storage } from 'src/common/multer.storage';
import { FfmpegInterceptor } from 'src/common/ffmpeg.interceptor';
import { EditMessageDTO } from 'src/message/dto/edit-message.dto';
import { GetMessagesQuery } from './dto/get-messages-query.dto';
import { CreateReactionDTO } from 'src/message/dto/create-reaction.dto';
import { DeleteReactionDTO } from 'src/message/dto/delete-reaction.dto';
import { CreatePollDTO } from 'src/message/dto/create-poll.dto';
import { CreateUserAnswerDTO } from 'src/message/dto/create-answer.dto';
import { RemoveAnswerDTO } from 'src/message/dto/remove-answer.dto';

@Controller('api/channels')
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly messageService: MessageService,
  ) {}

  @Post(':channelId/messages')
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: storage(UploadDestination.Attachments),
      limits: {
        fileSize: 512 * 1024,
        fieldSize: 3 * 1024 * 1024,
      },
    }),
    FfmpegInterceptor,
  )
  @HttpCode(HttpStatus.CREATED)
  @Permissions([ServerPermission.Write, ChannelPermission.Write])
  async createMessage(
    @Body() createMessageDTO: CreateMessageDTO,
    @Req() { member, channel }: RequestWithUser,
    @UploadedFiles() attachments: Express.Multer.File[],
  ) {
    if (channel.isRequestAccepted === false) {
      throw new BadRequestException(
        'Direct message request must be accepted first!',
      );
    }

    return this.channelService.createMessage(
      createMessageDTO,
      attachments,
      member,
    );
  }

  @Get(':channelId/messages')
  @Permissions([ChannelPermission.Read, ServerPermission.Read])
  async getMessages(
    @Channel() channel: ChannelEntity,
    @Req() { user }: RequestWithUser,
    @Query() query: GetMessagesQuery,
  ) {
    return this.channelService.getMessages(
      channel,
      user,
      channel.isRequestAccepted,
      query,
    );
  }

  @Delete('attachments/:attachmentId')
  @Permissions([ServerPermission.ManageMessages])
  async deleteAttachment(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Req() { user }: RequestWithUser,
  ) {
    return this.messageService.removeAttachment(attachmentId, user);
  }

  @Delete('/messages')
  @Permissions([ServerPermission.ManageMessages])
  deleteMessage(
    @Body() { messageId }: { messageId: number; channelId: number },
  ) {
    return this.messageService.deleteMessage(messageId);
  }

  @Patch('/messages')
  @Permissions([ServerPermission.ManageMessages])
  editMessage(
    @Req()
    {
      member,
      message: {
        channelId,
        channel: { isRequestAccepted },
      },
    }: RequestWithUser,
    @Body() editMessageDTO: EditMessageDTO,
  ) {
    if (isRequestAccepted === false) {
      throw new ForbiddenException({
        code: ErrorCode.Forbidden,
        message:
          'Request needs to be accepted first for you to be able to perform actions in this channel!',
        statusCode: HttpStatus.FORBIDDEN,
      });
    }

    return this.messageService.editMessage(member, channelId, editMessageDTO);
  }

  @Post('/messages/reactions')
  @Permissions([ServerPermission.ManageMessages])
  createReaction(
    @Req() { member }: RequestWithUser,
    @Body() createReactionDTO: CreateReactionDTO,
  ) {
    console.log(createReactionDTO);
    return this.messageService.addReaction(member, createReactionDTO);
  }

  @Delete('/messages/reactions')
  @Permissions([ServerPermission.ManageMessages])
  deleteReaction(
    @Req() { member }: RequestWithUser,
    @Body() deleteReactionDtTO: DeleteReactionDTO,
  ) {
    return this.messageService.deleteReaction(member, deleteReactionDtTO);
  }

  @Post('roles')
  @Permissions([ServerPermission.ManagePermissions, ChannelPermission.Edit])
  async addRole() {}

  @Patch('roles/permissions')
  @Permissions([ServerPermission.ManagePermissions, ChannelPermission.Edit])
  setRolePermissions(
    @Body() { channelId, roleName, allowed, denied }: PermissionsDTO,
  ) {}

  @Post('/polls')
  @Permissions([ServerPermission.Member])
  createPoll(
    @Body() createPollDTO: CreatePollDTO,
    @Req() { member }: RequestWithUser,
  ) {
    return this.messageService.createPoll(createPollDTO, member);
  }

  @Post('/polls/answers')
  @Permissions([ServerPermission.Member])
  createUserAnswer(
    @Body() createUserAnswerDTO: CreateUserAnswerDTO,
    @Req() { user: { id } }: RequestWithUser,
  ) {
    return this.messageService.createUserAnswer(createUserAnswerDTO, id);
  }

  @Delete('/polls/answers')
  @Permissions([ServerPermission.Member])
  removeUserAnswer(
    @Body() createUserAnswerDTO: RemoveAnswerDTO,
    @Req() { user: { id } }: RequestWithUser,
  ) {
    return this.messageService.removeUserAnswer(createUserAnswerDTO, id);
  }
}
