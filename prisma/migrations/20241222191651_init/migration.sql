-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE', 'PAUSE', 'UNPAUSE');

-- CreateEnum
CREATE TYPE "VoteRole" AS ENUM ('STAFF', 'VETERANS');

-- CreateEnum
CREATE TYPE "SubmissionState" AS ENUM ('RAW', 'WARNING', 'PROCESSING', 'PAUSED', 'ERROR', 'ACCEPTED', 'DENIED');

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "reviewThreadId" TEXT,
    "feedbackThreadId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" "SubmissionState" NOT NULL,
    "authorId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "techUsed" TEXT NOT NULL,
    "sourceLinks" TEXT NOT NULL,
    "otherLinks" TEXT NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "voterId" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "role" "VoteRole" NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("voterId","submissionId","type")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_messageId_key" ON "Submission"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_reviewThreadId_key" ON "Submission"("reviewThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_feedbackThreadId_key" ON "Submission"("feedbackThreadId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
