import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { SPRINT_LENGTH_DAYS } from './rules'
import { replay, todayStr } from './engine'
import { applyAction } from './actions'
import daysJournal from '../../data/days.json'
import type { Action, ManualLogPayload } from './actions'
import type { DayRecord, GameState, SkillId } from './types'

// The character is derived by replaying the committed journal (data/days.json).
// localStorage no longer holds the whole save - only the *draft of the current
// day* (quick activity taps + body edits) is persisted here, layered on top of
// the journal-derived base. Export/import still round-trips the full state.
const DRAFT_KEY = 'life-rpg-draft-v1'

// Cloud sync is opt-in: only active once VITE_APP_SECRET is set (i.e. once
// Supabase + the API routes are wired up). Until then the app behaves
// exactly as a local-only, localStorage-backed game.
const APP_SECRET = import.meta.env.VITE_APP_SECRET as string | undefined
const SYNC_ENABLED = Boolean(APP_SECRET)

const SYNCED_ACTION_TYPES = new Set(['TAP_QUEST', 'TOGGLE_FREEZE', 'UPDATE_FITNESS_STATS', 'LOG_MANUAL', 'NEW_SPRINT'])

function load(): GameState {
  const base = replay(daysJournal as DayRecord[])
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return base
    const draft = JSON.parse(raw) as Partial<GameState>
    // The draft only overlays the *current* day. A draft left over from a
    // previous day is dropped, so a new day starts clean from the journal.
    if (!draft || draft.today?.date !== base.today.date) return base
    return {
      ...base,
      today: draft.today ?? base.today,
      quests: draft.quests ?? base.quests,
      fitness: draft.fitness ?? base.fitness,
      frozen: draft.frozen ?? base.frozen,
    }
  } catch {
    return base
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${APP_SECRET}`,
      'Content-Type': 'application/json',
    },
  })
}

function reducer(state: GameState, action: Action): GameState {
  return applyAction(state, action)
}

interface Ctx {
  state: GameState
  dispatch: React.Dispatch<Action>
  exportSave: () => void
  importSave: (file: File) => Promise<void>
  syncEnabled: boolean
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
}

const GameContext = createContext<Ctx | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [syncStatus, setSyncStatus] = React.useState<Ctx['syncStatus']>(SYNC_ENABLED ? 'idle' : 'offline')
  const hydrated = useRef(false)

  // Persist only the current-day draft (quick activity + body edits). The rest
  // of the character is recomputed from the journal on every load, so there's
  // nothing else to keep here.
  useEffect(() => {
    const draft = {
      today: state.today,
      quests: state.quests,
      fitness: state.fitness,
      frozen: state.frozen,
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [state])

  // On first load, pull the latest state from the cloud (e.g. changes logged
  // via chat since the app was last opened) and adopt it.
  useEffect(() => {
    if (!SYNC_ENABLED) return
    let cancelled = false
    setSyncStatus('syncing')
    apiFetch('/api/state')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((remote: GameState) => {
        if (cancelled) return
        dispatch({ type: 'IMPORT', state: remote })
        setSyncStatus('synced')
      })
      .catch(() => {
        if (!cancelled) setSyncStatus('error')
      })
      .finally(() => {
        hydrated.current = true
      })
    return () => {
      cancelled = true
    }
  }, [])

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `life-rpg-save-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importSave = async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as GameState
    dispatch({ type: 'IMPORT', state: parsed })
    if (SYNC_ENABLED) {
      apiFetch('/api/state', { method: 'PUT', body: JSON.stringify(parsed) }).catch(() => {})
    }
  }

  // Wrap dispatch: apply locally immediately (snappy UI), and - once the
  // initial cloud hydration is done - also push the same action to the
  // server so it can be reproduced there (e.g. when Claude logs a day via
  // chat while the phone is closed, and the phone re-fetches on next open).
  const syncedDispatch: React.Dispatch<Action> = (action) => {
    dispatch(action)
    if (SYNC_ENABLED && hydrated.current && SYNCED_ACTION_TYPES.has(action.type)) {
      setSyncStatus('syncing')
      apiFetch('/api/log-day', { method: 'POST', body: JSON.stringify(action) })
        .then((r) => (r.ok ? setSyncStatus('synced') : setSyncStatus('error')))
        .catch(() => setSyncStatus('error'))
    }
  }

  const value = useMemo(
    () => ({ state, dispatch: syncedDispatch, exportSave, importSave, syncEnabled: SYNC_ENABLED, syncStatus }),
    [state, syncStatus],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): Ctx {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>')
  return ctx
}

export const SPRINT_DAYS = SPRINT_LENGTH_DAYS
export type { SkillId, ManualLogPayload }
