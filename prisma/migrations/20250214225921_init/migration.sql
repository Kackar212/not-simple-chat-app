-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('User', 'Request', 'Accepted', 'Declined', 'ServerInvitation', 'FriendInvitation', 'ReplyToPinnedMessage', 'UserPinnedMessage', 'UserStartedVoiceCall', 'VoiceCallEnded');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('Online', 'Offline');

-- CreateEnum
CREATE TYPE "SpecialStatus" AS ENUM ('DoNotDisturb', 'Idle');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('Text', 'Voice');

-- CreateEnum
CREATE TYPE "FriendStatus" AS ENUM ('Pending', 'Online', 'Offline');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('Gif', 'Image', 'Audio', 'Video', 'Pdf', 'Text', 'Other');

-- CreateEnum
CREATE TYPE "EmojiScope" AS ENUM ('Public', 'Private');

-- CreateTable
CREATE TABLE "Server" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(33) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "serverIcon" TEXT,
    "iconPlaceholder" TEXT,
    "ownerId" INTEGER NOT NULL,
    "ownerName" TEXT NOT NULL,
    "isGlobalServer" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "inviteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "expiration" INTEGER NOT NULL DEFAULT 7,
    "numberOfUses" INTEGER NOT NULL DEFAULT -1,
    "usesLeft" INTEGER NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverId" INTEGER NOT NULL,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("inviteId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(33) NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "resetPasswordToken" TEXT,
    "avatar" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#fff',
    "backgroundImage" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "Status" NOT NULL DEFAULT 'Offline',
    "specialStatus" "SpecialStatus",
    "isAccountActive" BOOLEAN NOT NULL DEFAULT false,
    "activateAccountToken" TEXT,
    "activationTokenExpiresIn" TIMESTAMP(3),
    "isInvisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "voiceChannelId" INTEGER,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isKickedOut" BOOLEAN NOT NULL DEFAULT false,
    "kickedOutUntil" TIMESTAMP(3),
    "kickedOutCount" INTEGER NOT NULL DEFAULT 0,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerProfile" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'Offline',
    "specialStatus" "SpecialStatus",
    "avatar" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#fff',
    "backgroundImage" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "isInvisible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'rgb(220, 220, 220)',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "roleName" TEXT NOT NULL,
    "roleServerId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("roleName","roleServerId","memberId")
);

-- CreateTable
CREATE TABLE "ChannelUser" (
    "channelId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "isChannelHidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChannelUser_pkey" PRIMARY KEY ("channelId","memberId")
);

-- CreateTable
CREATE TABLE "Friend" (
    "id" SERIAL NOT NULL,
    "friendName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "privateChannelId" INTEGER NOT NULL DEFAULT -1,
    "isPending" BOOLEAN NOT NULL DEFAULT true,
    "isInvited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blacklist" (
    "blockedUsername" TEXT NOT NULL,
    "blacklistOwnerUsername" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "permission" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "roleName" TEXT NOT NULL,
    "roleServerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" SERIAL NOT NULL,
    "name" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isRequestAccepted" BOOLEAN,
    "isCallPending" BOOLEAN NOT NULL DEFAULT false,
    "serverId" INTEGER NOT NULL,
    "type" "ChannelType" NOT NULL DEFAULT 'Text',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "channelId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'User',
    "isSystemMessage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "messageReferenceId" INTEGER,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinnedMessage" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER,

    CONSTRAINT "PinnedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FileType" NOT NULL,
    "contentType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "poster" TEXT,
    "placeholder" TEXT,
    "messageId" INTEGER NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embed" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "url" TEXT,
    "originalUrl" TEXT,
    "format" TEXT,
    "description" TEXT,
    "title" TEXT,
    "siteName" TEXT,
    "image" TEXT,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "poster" TEXT,

    CONSTRAINT "Embed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEmbed" (
    "messageId" INTEGER NOT NULL,
    "embedId" INTEGER NOT NULL,

    CONSTRAINT "MessageEmbed_pkey" PRIMARY KEY ("embedId","messageId")
);

-- CreateTable
CREATE TABLE "Emoji" (
    "id" SERIAL NOT NULL,
    "scope" "EmojiScope" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeholder" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,

    CONSTRAINT "Emoji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" SERIAL NOT NULL,
    "emojiId" INTEGER,
    "emojiName" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Server_isGlobalServer_key" ON "Server"("isGlobalServer");

-- CreateIndex
CREATE UNIQUE INDEX "Server_name_ownerName_key" ON "Server"("name", "ownerName");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_serverId_key" ON "InviteLink"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_activateAccountToken_key" ON "User"("activateAccountToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_username_key" ON "User"("id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Member_serverId_userId_key" ON "Member"("serverId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerProfile_memberId_key" ON "ServerProfile"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerProfile_serverId_memberId_key" ON "ServerProfile"("serverId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_serverId_key" ON "Role"("name", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_roleName_roleServerId_memberId_key" ON "UserRole"("roleName", "roleServerId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelUser_channelId_memberId_key" ON "ChannelUser"("channelId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Friend_friendName_username_key" ON "Friend"("friendName", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_blockedUsername_blacklistOwnerUsername_key" ON "Blacklist"("blockedUsername", "blacklistOwnerUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_roleName_permission_roleServerId_key" ON "Permission"("roleName", "permission", "roleServerId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_name_serverId_key" ON "Channel"("name", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "PinnedMessage_messageId_key" ON "PinnedMessage"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Emoji_serverId_name_key" ON "Emoji"("serverId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_messageId_memberId_emojiName_key" ON "Reaction"("messageId", "memberId", "emojiName");

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_ownerId_ownerName_fkey" FOREIGN KEY ("ownerId", "ownerName") REFERENCES "User"("id", "username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerProfile" ADD CONSTRAINT "ServerProfile_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerProfile" ADD CONSTRAINT "ServerProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleName_roleServerId_fkey" FOREIGN KEY ("roleName", "roleServerId") REFERENCES "Role"("name", "serverId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelUser" ADD CONSTRAINT "ChannelUser_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelUser" ADD CONSTRAINT "ChannelUser_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_friendName_fkey" FOREIGN KEY ("friendName") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_username_fkey" FOREIGN KEY ("username") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blacklist" ADD CONSTRAINT "Blacklist_blockedUsername_fkey" FOREIGN KEY ("blockedUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blacklist" ADD CONSTRAINT "Blacklist_blacklistOwnerUsername_fkey" FOREIGN KEY ("blacklistOwnerUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleName_roleServerId_fkey" FOREIGN KEY ("roleName", "roleServerId") REFERENCES "Role"("name", "serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_messageReferenceId_fkey" FOREIGN KEY ("messageReferenceId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEmbed" ADD CONSTRAINT "MessageEmbed_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEmbed" ADD CONSTRAINT "MessageEmbed_embedId_fkey" FOREIGN KEY ("embedId") REFERENCES "Embed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_emojiId_fkey" FOREIGN KEY ("emojiId") REFERENCES "Emoji"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
