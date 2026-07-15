// GET  /api/state -> rolls forward any missed days and returns current state
// PUT  /api/state -> overwrites state (used by "import save")
import { rollForward } from '../src/engine/engine.js'
import { checkAuth, getSupabase, ROW_ID } from './_shared.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (!checkAuth(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const supabase = getSupabase()

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('game_state').select('data').eq('id', ROW_ID).single()
    if (error || !data) {
      res.status(404).json({ error: 'not found - run the setup SQL first' })
      return
    }
    const state = rollForward(data.data)
    await supabase.from('game_state').update({ data: state, updated_at: new Date().toISOString() }).eq('id', ROW_ID)
    res.status(200).json(state)
    return
  }

  if (req.method === 'PUT') {
    const state = req.body
    await supabase.from('game_state').upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() })
    res.status(200).json(state)
    return
  }

  res.status(405).json({ error: 'method not allowed' })
}
