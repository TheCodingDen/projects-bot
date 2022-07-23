-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UP', 'DOWN', 'PAUSE');

-- CreateEnum
CREATE TYPE "VoteRole" AS ENUM ('STAFF', 'VETERANS');

-- CreateEnum
CREATE TYPE "SubmissionState" AS ENUM ('PROCESSING', 'APPROVED', 'REJECTED', 'PAUSED', 'DELETED');

-- CreateEnum
CREATE TYPE "SubmissionLinkType" AS ENUM ('SOURCE', 'OTHER');

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatedMessage" (
    "messageId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "RelatedMessage_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "Vote" (
    "voterId" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "role" "VoteRole" NOT NULL,
    "submissionId" TEXT NOT NULL,
    "submissionDetailsId" TEXT,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("voterId","submissionId","type")
);

-- CreateTable
CREATE TABLE "SubmissionDetails" (
    "submissionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reviewThreadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "techUsed" TEXT NOT NULL,
    "state" "SubmissionState" NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "SubmissionDetails_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "SubmissionLink" (
    "submissionId" TEXT NOT NULL,
    "id" SERIAL NOT NULL,
    "type" "SubmissionLinkType" NOT NULL,
    "url" TEXT NOT NULL,
    "submissionDetailsId" TEXT,

    CONSTRAINT "SubmissionLink_pkey" PRIMARY KEY ("submissionId","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionDetails_messageId_key" ON "SubmissionDetails"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionDetails_reviewThreadId_key" ON "SubmissionDetails"("reviewThreadId");

-- AddForeignKey
ALTER TABLE "RelatedMessage" ADD CONSTRAINT "RelatedMessage_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_submissionDetailsId_fkey" FOREIGN KEY ("submissionDetailsId") REFERENCES "SubmissionDetails"("submissionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionDetails" ADD CONSTRAINT "SubmissionDetails_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLink" ADD CONSTRAINT "SubmissionLink_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLink" ADD CONSTRAINT "SubmissionLink_submissionDetailsId_fkey" FOREIGN KEY ("submissionDetailsId") REFERENCES "SubmissionDetails"("submissionId") ON DELETE SET NULL ON UPDATE CASCADE;
