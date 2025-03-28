export enum SocketEvent {
  Message = 'message',
  Channel = 'channel',
  Unauthorized = 'unauthorized',
  JoinChannel = 'join',
  JoinPrivateRoom = 'joinPrivateRoom',
  Status = 'status',
  Typing = 'typing',
  Offer = 'offer',
  Candidate = 'candidate',
  Answer = 'answer',
  JoinVoiceChannel = 'joinVoiceChannel',
  UserJoinedVoiceChannel = 'userJoinedVoiceChannel',
  LeaveVoiceChannel = 'leaveVoiceChannel',
  UserLeftVoiceChannel = 'userLeftVoiceChannel',
  JoinServer = 'joinServer',
  UserJoinedServer = 'userJoinedServer',
  NewMemberInVoiceChannel = 'newMemberInVoiceChannel',
  TryReconnectToVoiceChannel = 'tryReconnectToVoiceChannel',
  ReconnectToVoiceChannel = 'reconnectToVoiceChannel',
  Members = 'members',
  RtcDisconnect = 'rtcDisconnect',
  Rejoin = 'rejoin',
  Punished = 'punished',
  LeaveServer = 'leaveServer',
  StartVoiceCall = 'startVoiceCall',
  EndVoiceCall = 'endVoiceCall',
  VoiceCallPending = 'voiceCallPending',
  VoiceCallStarted = 'voiceCallStarted',
  VoiceCallEnded = 'voiceCallEnded',
  DirectMessageChannel = 'directMessageChannel',
  Reaction = 'reaction',
  Emoji = 'emoji',
  Friend = 'friend',
  PollAnswer = 'pollAnswer',
}
