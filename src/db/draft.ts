import { Snowflake } from 'discord.js'
import { SubmissionId as Cuid } from '../types/misc'
import { query } from './client'

interface DraftGeneratedData {
  timestamp: Date
  id: string
}

export async function deleteDraft (id: Cuid): Promise<void> {
  return void query(db => db.draft.delete({
    where: {
      id
    }
  }))
}

export async function createDraft (content: string, authorId: Snowflake, submissionId: Cuid): Promise<DraftGeneratedData> {
  const data = await query(db => db.draft.create({
    data: {
      content,
      authorId,
      submissionId
    }
  }))

  return {
    timestamp: data.timestamp,
    id: data.id
  }
}
