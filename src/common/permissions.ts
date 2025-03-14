export enum ChannelPermission {
  Read = 'READ_CHANNEL',
  Write = 'WRITE_CHANNEL',
  Edit = 'EDIT_CHANNEL',
  Remove = 'REMOVE_CHANNEL',
}

export enum ServerPermission {
  Invite = 'INVITE',
  ManageChannels = 'MANAGE_CHANNELS',
  All = 'All',
  ManagePermissions = 'MANAGE_PERMISSIONS',
  Read = 'READ_SERVER',
  Write = 'WRITE_SERVER',
  Member = 'MEMBER',
  ManageMembers = 'MANAGE_MEMBERS',
  ManageServer = 'MANAGE_SERVER',
  ManageMessages = 'MANAGE_MESSAGES',
}

export const channelPermissions = [
  {
    key: ChannelPermission.Read,
    description: 'User with this permission can read messages in this channel',
    text: 'Read messages',
  },
  {
    key: ChannelPermission.Write,
    description: 'User with this permission can write messages in this channel',
    text: 'Send messages',
  },
  {
    key: ChannelPermission.Edit,
    description:
      'User with this permission can remove this channel and edit its details, like name or permissions',
    text: 'Manage channel',
  },
];

export const serverPermissions = [
  {
    key: ServerPermission.Read,
    description: 'User with this permission can read messages in every channel',
    text: 'Read messages in every channel',
  },
  {
    key: ServerPermission.Write,
    description: 'User with this permission can write messages in this channel',
    text: 'Send messages',
  },
  {
    key: ServerPermission.Invite,
    description:
      'User with this permission can invite people to this server and change options of invite link',
  },
  {
    key: ServerPermission.ManageChannels,
    description:
      'User with this permission can create, edit or remove channels on this server',
  },
  {
    key: ServerPermission.ManagePermissions,
    description:
      'User with this permission can manage roles and permissions on this server',
  },
  {
    key: ServerPermission.ManageMembers,
    description:
      "User with this permission can ban or kick out members, also user is allowed to edit members' roles",
  },
  {
    key: ServerPermission.ManageServer,
    description:
      "User with this permission can edit servers' settings or delete it",
  },
  {
    key: ServerPermission.ManageMessages,
    description: 'User with this permission can edit, remove or hide messages',
  },
];
