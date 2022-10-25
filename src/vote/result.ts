export type VoteResultOutcome = 'vote-add' | 'accept' | 'reject' | 'instant-reject' | 'pause' | 'unpause'

interface VoteResultOk {
  error: false
  outcome: VoteResultOutcome
}

interface VoteResultErr {
  error: true
  message: string
}

export type VoteModificationResult = VoteResultOk | VoteResultErr
