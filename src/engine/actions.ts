// Pure action-application logic, shared between the browser (client reducer
// in store.tsx) and the Vercel serverless functions (api/log-day.ts). No
// React/DOM here on purpose so it can run in either environment untouched.
import { CALORIE_CORRIDOR, CALORIE_CORRIDOR_XP, DEFAULT_QUESTS, FITNESS_ACTIVITY_XP, MANUAL_XP, SLEEP_GOOD_RANGE, SLEEP_GOOD_XP } from './rules.js'
import { rollForward, todayStr } from './engine.js'
import type { FitnessStats, GameState } from './types.js'

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

export type Action =
  | { type: 'ROLL_FORWARD' }
  | { type: 'TAP_QUEST'; id: string; delta: 1 | -1 }
  | { type: 'TOGGLE_FREEZE' }
  | { type: 'UPDATE_FITNESS_STATS'; stats: Partial<FitnessStats> }
  | { type: 'LOG_MANUAL'; payload: ManualLogPayload }
  | { type: 'NEW_SPRINT' }
  | { type: 'IMPORT'; state: GameState }

export function applyAction(state: GameState, action: Action): GameState {
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

      if (p.pmHours) today.xpBySkill.pm = (today.xpBySkill.pm ?? 0) + Math.min(p.pmHours, MANUAL_XP.pm.hoursCap) * MANUAL_XP.pm.perHour
      if (p.productStudyHours) today.xpBySkill.product = (today.xpBySkill.product ?? 0) + Math.min(p.productStudyHours, MANUAL_XP.productStudy.hoursCap) * MANUAL_XP.productStudy.perHour
      if (p.productPracticeHours) today.xpBySkill.product = (today.xpBySkill.product ?? 0) + Math.min(p.productPracticeHours, MANUAL_XP.productPractice.hoursCap) * MANUAL_XP.productPractice.perHour

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
