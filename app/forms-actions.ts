'use server'

import { submitBeta, submitInquiry } from '@/lib/forms'
import type { FormState } from '@/lib/forms'

export async function betaAction(_prev: FormState, form: FormData): Promise<FormState> {
  return submitBeta(form)
}

export async function inquiryAction(_prev: FormState, form: FormData): Promise<FormState> {
  return submitInquiry(form)
}
