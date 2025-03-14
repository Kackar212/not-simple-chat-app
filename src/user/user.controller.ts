import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  Permissions,
  RequestWithUser,
  ServerPermission,
  SessionGuard,
  UploadDestination,
  validators,
} from 'src/common';
import { storage } from 'src/common/multer.storage';
import { InviteDTO } from 'src/friend/dto/invite.dto';
import { FriendStatus } from 'src/friend/friend-status.enum';
import { FriendService } from 'src/friend/friend.service';
import { InviteUserDTO } from 'src/invitation/dto/invite-user.dto';
import { AddRoleDTO } from 'src/user/dto/add-role.dto';
import { ResetPasswordDTO } from 'src/user/dto/reset-password.dto';
import { UserService } from 'src/user/user.service';
import { UpdateUserDTO } from './dto/update-user.dto';

@Controller('api/users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly friendService: FriendService,
  ) {}

  @Get('me')
  @UseGuards(SessionGuard)
  async getCurrentUser(
    @Req() { user }: RequestWithUser,
    @Query('serverId', new DefaultValuePipe(-1), ParseIntPipe) serverId: number,
  ) {
    return this.userService.getUser(user, serverId);
  }

  @Patch('/me')
  @UseGuards(SessionGuard)
  @UseInterceptors(
    FileInterceptor('avatar', { storage: storage(UploadDestination.Avatars) }),
  )
  async updateUser(
    @Body()
    updateUserDTO: UpdateUserDTO,
    @Req() { user }: RequestWithUser,
    @UploadedFile(new ParseFilePipe({ validators, fileIsRequired: false }))
    avatar?: Express.Multer.File,
  ) {
    return this.userService.updateUser(updateUserDTO, user, avatar);
  }

  @Post('invite')
  @UseGuards(SessionGuard)
  @HttpCode(201)
  @Permissions([ServerPermission.Invite])
  async invite(
    @Body() { username }: InviteUserDTO,
    @Req() { member, server }: RequestWithUser,
  ) {
    return this.userService.invite({ server, member, username });
  }

  @Patch('me/reset-password')
  @UseGuards(SessionGuard)
  async resetPassword(
    @Body() resetPasswordDTO: ResetPasswordDTO,
    @Req() { user }: RequestWithUser,
  ) {
    return this.userService.resetPassword(resetPasswordDTO, user);
  }

  @Get('roles/:serverId')
  @UseGuards(SessionGuard)
  getRoles(
    @Param('serverId', ParseIntPipe) serverId: number,
    @Req() { user }: RequestWithUser,
  ) {
    return this.userService.getRoles(serverId, user);
  }

  @Post('roles')
  @UseGuards(SessionGuard)
  addRole(@Body() addRoleDTO: AddRoleDTO) {
    return this.userService.addRole(addRoleDTO);
  }

  @Get('me/servers')
  @UseGuards(SessionGuard)
  getServers(@Req() { user }: RequestWithUser) {
    return this.userService.getServers(user);
  }

  @Get('me/servers/:serverId')
  @UseGuards(SessionGuard)
  getServer(
    @Req() { user }: RequestWithUser,
    @Param('serverId', ParseIntPipe) serverId: number,
  ) {
    return this.userService.getServer(user, serverId);
  }

  @Get('me/friends/:status?')
  @UseGuards(SessionGuard)
  getFriends(
    @Req() { user }: RequestWithUser,
    @Query('hasDM', new ParseBoolPipe({ optional: true })) hasDM?: boolean,
    @Param(
      'status',
      new ParseEnumPipe(FriendStatus, {
        optional: true,
      }),
    )
    status?: FriendStatus,
  ) {
    //console.log(query, body, paginationQuery);
    return this.friendService.getFriends(user, hasDM, status);
  }

  @Post('me/friends')
  @UseGuards(SessionGuard)
  inviteFriend(
    @Body() { friendName }: InviteDTO,
    @Req() { user }: RequestWithUser,
  ) {
    return this.friendService.inviteFriend(friendName, user);
  }

  @Patch('me/friends')
  @UseGuards(SessionGuard)
  acceptOrDeclineFriend(
    @Body()
    { friendName }: { friendName: string; action: 'accept' | 'decline' },
    @Req() { user }: RequestWithUser,
  ) {
    return this.friendService.acceptFriend(user, friendName);
  }

  @Delete('me/friends')
  @UseGuards(SessionGuard)
  deleteFriend(
    @Body() { username }: { username: string },
    @Req() { user }: RequestWithUser,
  ) {
    return this.friendService.delete(username, user);
  }

  @Post('me/blacklist')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SessionGuard)
  block(
    @Body() { username }: { username: string },
    @Req() { user }: RequestWithUser,
  ) {
    return this.friendService.block(username, user);
  }

  @Delete('me/blacklist')
  @UseGuards(SessionGuard)
  unblock(
    @Body() { username }: { username: string },
    @Req() { user }: RequestWithUser,
  ) {
    return this.friendService.unblock(username, user);
  }

  @Get('me/blacklist')
  @UseGuards(SessionGuard)
  getBlacklist(@Req() { user }: RequestWithUser) {
    return this.userService.getBlacklist(user);
  }

  @Get('me/mutual')
  @UseGuards(SessionGuard)
  async getMutual(
    @Query('with', ParseIntPipe) mutualWith: number,
    @Req() { user }: RequestWithUser,
    @Query('onlyCount') onlyCount?: string,
  ) {
    if (onlyCount) {
    }

    return await this.userService.getMutual(user, mutualWith);
  }

  @Get('me/profile')
  @UseGuards(SessionGuard)
  getCurrentUserProfile(
    @Req() { user }: RequestWithUser,
    @Query('serverId', new DefaultValuePipe(-1), ParseIntPipe)
    serverId: number,
  ) {
    return this.userService.getMemberProfile(user, {
      userId: user.id,
      serverId,
    });
  }

  @Get(':userId/profile')
  @UseGuards(SessionGuard)
  async getProfile(
    @Param('userId') userId: number,
    @Req() { user }: RequestWithUser,
    @Query('serverId', new DefaultValuePipe(-1), ParseIntPipe)
    serverId: number,
  ) {
    return this.userService.getMemberProfile(user, { userId, serverId });
  }

  @Get('emojis')
  @UseGuards(SessionGuard)
  async getEmojisForAllServers(@Req() { user }: RequestWithUser) {
    return this.userService.getEmojis(user);
  }
}
