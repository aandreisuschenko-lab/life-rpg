// Core data shapes for the Life-RPG save file.
// Everything here is plain JSON-serializable so it can be persisted to
// localStorage and exported/imported as a .json save file.

export type SkillId = 'pm' | 'product' | 'discipline'

export interface SkillState {
  id: SkillId
  name: string
  icon: string
  level: number // 1-100, can go down
  xp: number // progress toward next level, 0..xpToNext(level)
  peakLevel: number // highest level ever reached - defines the "floor" (peak - 15)
}

export interface QuestDef {
  id: string
  label: string
  icon: string
  target: number // how many ticks to finish the sprint quest
  xpPerTick: number
  // where the XP goes: a skill id, or 'fitness' for the regularity pool
  reward: SkillId | 'fitness'
}

export interface QuestState extends QuestDef {
  progress: number
}

export interface FitnessStats {
  pullups: number
  pushups: number
  bodyFatPct: number
  weightKg: number
}

export interface LogEntry {
  date: string // yyyy-mm-dd
  xp: number
}

export interface WeightEntry {
  date: string
  weight: number
}

export interface DayEntry {
  date: string
  xpBySkill: Record<string, number> // gross xp earned that day, before upkeep
  fitnessXp: number // gross fitness/regularity xp earned that day
  sleepHours?: number
  calories?: number
  mood?: number // 1-5
  note?: string
  weightKg?: number
}

export interface GameState {
  version: 1
  createdAt: string
  sprintStart: string
  frozen: boolean
  lastProcessedDate: string // last calendar day the engine has closed out
  skills: Record<SkillId, SkillState>
  fitness: FitnessStats
  weightLog: WeightEntry[]
  regularityLog: LogEntry[] // daily fitness xp, used for the 14-day regularity score
  activityLog: LogEntry[] // daily total xp across everything, used for the 7-day activity rating
  quests: QuestState[]
  today: DayEntry
  history: DayEntry[] // closed-out days, most recent last
}
