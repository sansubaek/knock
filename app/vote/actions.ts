'use server'

import { submitVote, type VoteState } from '@/lib/vote-server'

export async function voteAction(_prev: VoteState, form: FormData): Promise<VoteState> {
  return submitVote(form)
}
