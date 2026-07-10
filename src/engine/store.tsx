import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { CALORIE_CORRIDOR, CALORIE_CORRIDOR_XP, DEFAULT_QUESTS, FITNESS_ACTIVITY_XP, SLEEP_GOOD_RANGE, SLEEP_GOOD_XP, SPRINT_LENGTH_DAYS } from './rules'
import { createInitialState, rollForward, todayStr } from './engine'
import type { FitnessStats, GameState, SkillId } from './types'

const STORAGE_KEY = 'life-rpg-save-v1'

function load(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as GameState
    if (!parsed || parsed.version !== 1) return createInitialState()
    return parsed
  } catch {
    return createInitialState()
  }
}

type Action =
  | { type: 'ROLL_FORWARD' }
  | { type: 'TAP_QUEST'; id: string; delta: 1 | -1 }
  | { type: 'TOGGLE_FREEZE' }
  | { type: 'UPDATE_FITNESS_STATS'; stats: Partial<FitnessStats> }
  | { type: 'LOG_MANUAL'; payload: ManualLogPayload }
  | { type: 'NEW_SPRINT' }
  | { type: 'IMPORT'; state: GameState }

export interface ManualLogPayload {
  pmHours?: number
  productStudyHours?: number
  productPracticeHours?: number
  workout?: 'strength' | 'cardio' | 'steps10k' | 'stretch' | 'none'
  sleepHours?: number
  calories?: number
  mood?: number
  note?: string
  weightKg?: number
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ROLL_FORWARD':
      return rollForward(state)

    case 'TAP_QUEST': {
      const quests = state.quests.map((q) => {
        if (q.id !== action.id) return q
        const progress = Math.max(0, Math.min(q.target, q.progress + action.delta))
        return { ...q, progress }
      })
      const quest = state.quests.find((q) => q.id === action.id)
      if (!quest) return { ...state, quests }
      const xpDelta = action.delta * quest.xpPerTick
      const today = { ...state.today }
      if (quest.reward === 'fitness') {
        today.fitnessXp = Math.max(0, today.fitnessXp + xpDelta)
      } else {
        today.xpBySkill = { ...today.xpBySkill, [quest.reward]: Math.max(0, (today.xpBySkill[quest.reward] ?? 0) + xpDelta) }
      }
      return { ...state, quests, today }
    }

    case 'TOGGLE_FREEZE':
      return { ...state, frozen: !state.frozen }

    case 'UPDATE_FITNESS_STATS':
      return { ...state, fitness: { ...state.fitness, ...action.stats } }

    case 'NEW_SPRINT':
      return {
        ...state,
        sprintStart: todayStr(),
        quests: DEFAULT_QUESTS.map((q) => ({ ...q, progress: 0 })),
      }

    case 'IMPORT':
      return action.state

    case 'LOG_MANUAL': {
      const p = action.payload
      const today = { ...state.today, xpBySkill: { ...state.today.xpBySkill } }

      if (p.pmHours) today.xpBySkill.pm = (today.xpBySkill.pm ?? 0) + Math.min(p.pmHours, 6) * 15
      if (p.productStudyHours) today.xpBySkill.product = (today.xpBySkill.product ?? 0) + Math.min(p.productStudyHours, 3) * 30
      if (p.productPracticeHours) today.xpBySkill.product = (today.xpBySkill.product ?? 0) + Math.min(p.productPracticeHours, 2) * 60

      if (p.workout && p.workout !== 'none') {
        today.fitnessXp = today.fitnessXp + FITNESS_ACTIVITY_XP[p.workout]
      }

      if (p.sleepHours != null) {
        today.sleepHours = p.sleepHours
        if (p.sleepHours >= SLEEP_GOOD_RANGE.min && p.sleepHours <= SLEEP_GOOD_RANGE.max) {
          today.xpBySkill.discipline = (today.xpBySkill.discipline ?? 0) + SLEEP_GOOD_XP
        }
      }
      if (p.calories != null) {
        today.calories = p.calories
        if (p.calories >= CALORIE_CORRIDOR.min && p.calories <= CALORIE_CORRIDOR.max) {
          today.xpBySkill.discipline = (today.xpBySkill.discipline ?? 0) + CALORIE_CORRIDOR_XP
        }
      }
      if (p.mood != null) today.mood = p.mood
      if (p.note != null) today.note = p.note
      if (p.weightKg != null) today.weightKg = p.weightKg

      return { ...state, today }
    }

    default:
      return state
  }
}

interface Ctx {
  state: GameState
  dispatch: React.Dispatch<Action>
  exportSave: () => void
  importSave: (file: File) => Promise<void>
}

const GameContext = createContext<Ctx | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    dispatch({ type: 'ROLL_FORWARD' })
    const onFocus = () => dispatch({ type: 'ROLL_FORWARD' })
    window.addEventListener('focus', onFocus)
    const interval = setInterval(onFocus, 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
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
  }

  const value = useMemo(() => ({ state, dispatch, exportSave, importSave }), [state])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): Ctx {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>')
  return ctx
}

export const SPRINT_DAYS = SPRINT_LENGTH_DAYS
export type { SkillId }
