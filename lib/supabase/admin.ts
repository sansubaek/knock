import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/env'

/**
 * service_role 키로 RLS를 건너뛰는 클라이언트.
 * 서버 코드(서버 액션, 라우트, 서버 컴포넌트)에서만 쓴다. 'server-only' 덕분에
 * 브라우저 코드에서 불러오면 빌드가 실패한다.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 없습니다')
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
