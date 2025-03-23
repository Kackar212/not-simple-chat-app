-- CreateTable
CREATE TABLE "Poll" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "correctAnswerId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollAnswer" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "PollAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollUserAnswer" (
    "id" SERIAL NOT NULL,
    "pollAnswerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PollUserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Poll_correctAnswerId_key" ON "Poll"("correctAnswerId");

-- CreateIndex
CREATE UNIQUE INDEX "PollUserAnswer_pollAnswerId_userId_key" ON "PollUserAnswer"("pollAnswerId", "userId");

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_correctAnswerId_fkey" FOREIGN KEY ("correctAnswerId") REFERENCES "PollAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollAnswer" ADD CONSTRAINT "PollAnswer_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollUserAnswer" ADD CONSTRAINT "PollUserAnswer_pollAnswerId_fkey" FOREIGN KEY ("pollAnswerId") REFERENCES "PollAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollUserAnswer" ADD CONSTRAINT "PollUserAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
