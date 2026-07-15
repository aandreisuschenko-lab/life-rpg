// Shared helpers for the two API routes. Kept tiny on purpose - this is a
// personal single-user app, not a multi-tenant product.
import { createClient } from '@supabase/supabase-js'

export const ROW_ID = 'andrei'

export function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
  }
  return createClient(url, key)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkAuth(req: any): boolean {
  const auth = req.headers?.authorization ?? ''
  const secret = process.env.LOG_API_SECRET
  return Boolean(secret) && auth === `Bearer ${secret}`
}
