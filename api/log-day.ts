// POST /api/log-day  body: an Action (same shape as src/engine/actions.ts)
// Applies it server-side (after catching up on any missed days) and
// persists the result. This is what Claude calls when you describe your day
// in chat instead of tapping through the phone UI.
import { rollForward } from '../src/engine/engine'
import { applyAction } from '../src/engine/actions'
import type { Action } from '../src/engine/actions'
import { checkAuth, getSupabase, ROW_ID } from './_shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  if (!checkAuth(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  // Accepts a single action or an array of actions (applied in order) - handy
  // for logging a whole day (several quest ticks + a manual log) in one call.
  const body = req.body as Action | Action[]
  const actions = Array.isArray(body) ? body : [body]
  if (actions.length === 0 || actions.some((a) => !a?.type)) {
    res.status(400).json({ error: 'missing action.type' })
    return
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.from('game_state').select('data').eq('id', ROW_ID).single()
  if (error || !data) {
    res.status(404).json({ error: 'not found - run the setup SQL first' })
    return
  }

  let state = rollForward(data.data)
  for (const action of actions) {
    state = applyAction(state, action)
  }

  await supabase.from('game_state').update({ data: state, updated_at: new Date().toISOString() }).eq('id', ROW_ID)
  res.status(200).json(state)
}
