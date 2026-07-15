// Pure game-logic functions. No React here on purpose - this file can be
// unit-tested or reused (e.g. in a future Telegram bot) without touching UI.
import {
  DEFAULT_QUESTS,
  DEFAULT_SKILL_META,
  IDLE_ACTIVITY_THRESHOLD,
  IDLE_UPKEEP_MULTIPLIER,
  LEVEL_CAP,
  LEVEL_FLOOR_MARGIN,
  activityRating,
  bodyScore,
  clamp,
  dailyUpkeep,
  fitnessLevel,
  heroLevel,
  regularityScore,
  xpToNext,
} from './rules'
import type { DayEntry, DayRecord, GameState, LogEntry, QuestState, SkillId, SkillState } from './types'

export function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return todayStr(d)
}

function emptyDay(date: string): DayEntry {
  return { date, xpBySkill: { pm: 0, product: 0, discipline: 0 }, fitnessXp: 0 }
}

export function createInitialState(): GameState {
  const today = todayStr()
  const skills: GameState['skills'] = {
    pm: { id: 'pm', ...DEFAULT_SKILL_META.pm, level: 60, xp: 0, peakLevel: 60 },
    product: { id: 'product', ...DEFAULT_SKILL_META.product, level: 2, xp: 0, peakLevel: 2 },
    discipline: { id: 'discipline', ...DEFAULT_SKILL_META.discipline, level: 10, xp: 0, peakLevel: 10 },
  }
  return {
    version: 1,
    createdAt: today,
    sprintStart: today,
    frozen: false,
    lastProcessedDate: today,
    skills,
    fitness: { pullups: 5, pushups: 25, bodyFatPct: 22, weightKg: 83 },
    weightLog: [{ date: today, weight: 83 }],
    regularityLog: [],
    activityLog: [],
    quests: DEFAULT_QUESTS.map((q) => ({ ...q, progress: 0 })),
    today: emptyDay(today),
    history: [],
  }
}

function sumLast(log: LogEntry[], days: number, beforeDate: string): number {
  const cutoff = addDays(beforeDate, -days)
  return log.filter((e) => e.date > cutoff && e.date <= beforeDate).reduce((a, e) => a + e.xp, 0)
}

function levelSkillFromXp(skill: SkillState, grossXp: number, idleActive: boolean, frozen: boolean): SkillState {
  if (frozen) return skill
  const upkeep = dailyUpkeep(skill.level) * (idleActive ? IDLE_UPKEEP_MULTIPLIER : 1)
  let xp = skill.xp + grossXp - upkeep
  let level = skill.level
  let peakLevel = skill.peakLevel
  const floor = Math.max(1, peakLevel - LEVEL_FLOOR_MARGIN)

  while (xp >= xpToNext(level) && level < LEVEL_CAP) {
    xp -= xpToNext(level)
    level += 1
  }
  while (xp < 0 && level > floor) {
    level -= 1
    xp += xpToNext(level)
  }
  if (level <= floor) {
    level = floor
    xp = Math.max(0, xp)
  }
  xp = clamp(xp, 0, xpToNext(level))
  peakLevel = Math.max(peakLevel, level)
  return { ...skill, level, xp: Math.round(xp), peakLevel }
}

// Close out a single calendar day: apply upkeep, level changes, push to
// history, append to the rolling logs. Returns the new state.
function closeDay(state: GameState, entry: DayEntry): GameState {
  const grossTotal =
    Object.values(entry.xpBySkill).reduce((a, b) => a + b, 0) + entry.fitnessXp
  const sum7 = sumLast(state.activityLog, 7, entry.date) + grossTotal
  const idleActive = activityRating(sum7) < IDLE_ACTIVITY_THRESHOLD

  const skills: GameState['skills'] = { ...state.skills }
  ;(Object.keys(skills) as SkillId[]).forEach((id) => {
    skills[id] = levelSkillFromXp(skills[id], entry.xpBySkill[id] ?? 0, idleActive, state.frozen)
  })

  const activityLog = [...state.activityLog, { date: entry.date, xp: grossTotal }]
  const regularityLog = state.frozen
    ? state.regularityLog
    : [...state.regularityLog, { date: entry.date, xp: entry.fitnessXp }]

  const weightLog =
    entry.weightKg != null
      ? [...state.weightLog, { date: entry.date, weight: entry.weightKg }]
      : state.weightLog

  return {
    ...state,
    skills,
    activityLog,
    regularityLog,
    weightLog,
    history: [...state.history, entry],
    lastProcessedDate: entry.date,
  }
}

// Called on load (and periodically) to catch up on any days that passed
// without the app being open. Idle days are closed out with zero earnings,
// which is exactly what makes upkeep bite while you're away.
export function rollForward(state: GameState): GameState {
  const now = todayStr()
  if (state.lastProcessedDate >= now) return state

  let s = state
  let cursor = state.lastProcessedDate
  // Close out state.today using cursor's date, then empty days until `now`.
  const firstEntry = { ...s.today, date: cursor }
  s = closeDay(s, firstEntry)
  cursor = addDays(cursor, 1)
  while (cursor < now) {
    s = closeDay(s, emptyDay(cursor))
    cursor = addDays(cursor, 1)
  }
  return { ...s, today: emptyDay(now), lastProcessedDate: now }
}

function recordToDayEntry(rec: DayRecord): DayEntry {
  return {
    date: rec.date,
    xpBySkill: {
      pm: rec.xp?.pm ?? 0,
      product: rec.xp?.prod ?? 0,
      discipline: rec.xp?.disc ?? 0,
    },
    fitnessXp: rec.fit ?? 0,
    sleepHours: rec.sleep,
    calories: rec.calories,
    mood: rec.mood,
    note: rec.note,
    weightKg: rec.weightKg,
  }
}

// Quest progress recorded in the journal is applied as-is (it drives the sprint
// bars) - it does NOT re-award XP, because the day's XP already lives in the
// record's `xp`/`fit` fields.
function applyQuestProgress(quests: QuestState[], ticks: Record<string, number>): QuestState[] {
  return quests.map((q) => {
    const delta = ticks[q.id]
    if (!delta) return q
    return { ...q, progress: clamp(q.progress + delta, 0, q.target) }
  })
}

// Rebuild the whole character from the committed day journal (data/days.json).
// Starts from the seed hero and closes out each record in date order, applying
// the same XP earning, daily upkeep, level roll-back, peak-minus-15 floor and
// freeze rules as the live app. The journal is the source of truth; the
// current-day draft is layered on top separately in the store.
export function replay(records: DayRecord[]): GameState {
  const sorted = records
    .filter((r) => r && typeof r.date === 'string')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  let s = createInitialState()
  for (const rec of sorted) {
    s = closeDay(s, recordToDayEntry(rec))
    if (rec.quests) s = { ...s, quests: applyQuestProgress(s.quests, rec.quests) }
  }
  return { ...s, today: emptyDay(todayStr()) }
}

export interface Derived {
  heroLevel: number
  activityRating: number
  fitnessLevel: number
  regularityScore: number
  bodyScore: number
  idleActive: boolean
  floors: Record<SkillId, number>
  todayGrossTotal: number
  officeUnlocked: boolean
}

export function deriveView(state: GameState): Derived {
  const sum7 =
    sumLast(state.activityLog, 6, state.today.date) +
    Object.values(state.today.xpBySkill).reduce((a, b) => a + b, 0) +
    state.today.fitnessXp
  const sum14 = sumLast(state.regularityLog, 13, state.today.date) + state.today.fitnessXp
  const fLevel = fitnessLevel(sum14, state.fitness)
  const rating = activityRating(sum7)
  const floors: Record<SkillId, number> = {
    pm: Math.max(1, state.skills.pm.peakLevel - LEVEL_FLOOR_MARGIN),
    product: Math.max(1, state.skills.product.peakLevel - LEVEL_FLOOR_MARGIN),
    discipline: Math.max(1, state.skills.discipline.peakLevel - LEVEL_FLOOR_MARGIN),
  }
  return {
    heroLevel: heroLevel({
      pm: state.skills.pm.level,
      product: state.skills.product.level,
      fitness: fLevel,
      discipline: state.skills.discipline.level,
      activityRating: rating,
    }),
    activityRating: rating,
    fitnessLevel: fLevel,
    regularityScore: regularityScore(sum14),
    bodyScore: bodyScore(state.fitness),
    idleActive: rating < IDLE_ACTIVITY_THRESHOLD,
    floors,
    todayGrossTotal: Object.values(state.today.xpBySkill).reduce((a, b) => a + b, 0) + state.today.fitnessXp,
    officeUnlocked: state.skills.product.level >= 25,
  }
}
