/*
  Warnings:

  - A unique constraint covering the columns `[userId,pollId]` on the table `PollUserAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PollUserAnswer_pollAnswerId_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PollUserAnswer_userId_pollId_key" ON "PollUserAnswer"("userId", "pollId");
