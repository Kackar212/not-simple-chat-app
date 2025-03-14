import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ChannelPermission, ServerPermission } from '../permissions';
import {
  SessionGuard,
  WsSessionGuard,
  WebsocketServerPermissionsGuard,
  ServerPermissionsGuard,
} from 'src/common/guards';

export enum PermissionType {
  Channel = 'channel-permissions',
  Server = 'server-permissions',
}

export const PERMISSIONS_METADATA_KEY = 'PERMISSIONS';

export const Permissions = function (
  permissions?: Array<ChannelPermission | ServerPermission>,
  isWebsocket: boolean = false,
) {
  return applyDecorators(
    SetMetadata(PERMISSIONS_METADATA_KEY, permissions || []),
    UseGuards(
      isWebsocket ? WsSessionGuard : SessionGuard,
      isWebsocket ? WebsocketServerPermissionsGuard : ServerPermissionsGuard,
    ),
  );
};
