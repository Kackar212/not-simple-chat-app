import { $Enums } from '@prisma/client';

export const HASH_ROUNDS = 10;
export const ATTACHMENTS_UPLOAD_PATH = '/attachments';
export const ATTACHMENTS_UPLOAD_DESTINATION = './public/attachments';
export const DEFAULT_USER_AVATAR = '/avatars/default.svg';

export const UploadDestination = {
  Attachments: 'attachments',
  Avatars: 'avatars',
  ServerIcons: 'server-icons',
  Emojis: 'emojis',
  Posters: 'posters',
  External: 'external',
} as const;

export const rooms = {
  channel: (
    channelId: number,
    type: $Enums.ChannelType = $Enums.ChannelType.Text,
  ) => `channel/${type}/${channelId}` as const,
  privateRoom: (username: string) => `private/${username}` as const,
  server: (serverId: number) => `server/${serverId}` as const,
} as const;

export const VIDEO_OUTPUT_FORMAT = 'mp4';

export const ErrorCode = {
  Internal: 'INTERNAL',
  NotFound: 'NOT_FOUND',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  WrongCredentials: 'WRONG_CREDENTIALS',
  UserBanned: 'USER_BANNED',
  UserKicked: 'USER_KICKED',
  IncorrectOldPassword: 'INCORRECT_OLD_PASSWORD',
  InvalidToken: 'INVALID_TOKEN',
  InactiveAccount: 'INACTIVE_ACCOUNT',
  InvalidFriendUsername: 'INVALID_FRIEND_USERNAME',
  LimitReached: 'LIMIT_REACHED',
  BadRequestException: 'BAD_REQUEST_EXCEPTION',
  SelfInvited: 'SELF_INVITED',
  TokenExpired: 'TOKEN_EXPIRED',
} as const;

export const Limit = {
  Emojis: 50,
  Friends: 50,
  Members: 50,
};
