/*
  Warnings:

  - Added the required column `type` to the `Poll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pollId` to the `PollUserAnswer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PollType" AS ENUM ('Default', 'Quiz');

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "type" "PollType" NOT NULL;

-- AlterTable
ALTER TABLE "PollUserAnswer" ADD COLUMN     "pollId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "PollUserAnswer" ADD CONSTRAINT "PollUserAnswer_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
