/*
  Warnings:

  - You are about to drop the column `type` on the `Poll` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Poll" DROP COLUMN "type";

-- DropEnum
DROP TYPE "PollType";
