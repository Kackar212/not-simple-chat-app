/*
  Warnings:

  - You are about to drop the column `correctAnswerId` on the `Poll` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Poll" DROP CONSTRAINT "Poll_correctAnswerId_fkey";

-- DropIndex
DROP INDEX "Poll_correctAnswerId_key";

-- AlterTable
ALTER TABLE "Poll" DROP COLUMN "correctAnswerId";

-- AlterTable
ALTER TABLE "PollAnswer" ADD COLUMN     "isCorrectAnswer" BOOLEAN;
