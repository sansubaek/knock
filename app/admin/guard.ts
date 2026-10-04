import 'server-only'
import { getSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** 서버 액션 안에서 관리자인지 다시 확인 (페이지 보호만 믿지 않는다) */
export async function adminOrThrow() {
  const { user, profile } = await getSession()
  if (!user || profile?.role !== 'admin') throw new Error('관리자만 할 수 있어요')
  return { user, db: createAdminClient() }
}

export async function log(db: ReturnType<typeof createAdminClient>, actor: string, action: string, target?: string) {
  await db.from('admin_logs').insert({ actor_id: actor, action, target: target ?? null })
}
