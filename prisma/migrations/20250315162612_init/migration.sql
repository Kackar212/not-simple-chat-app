/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `Poll` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Poll_messageId_key" ON "Poll"("messageId");
