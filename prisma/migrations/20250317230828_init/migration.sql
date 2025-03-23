-- CreateEnum
CREATE TYPE "PollType" AS ENUM ('Poll', 'Quiz');

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "type" "PollType" NOT NULL DEFAULT 'Poll';
