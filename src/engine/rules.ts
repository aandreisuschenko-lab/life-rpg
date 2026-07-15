// ---------------------------------------------------------------------------
// Game balance. Every tunable number lives in this file on purpose - if you
// want falling to hurt more, or leveling to feel faster, change it here and
// nothing else needs to be touched.
// ---------------------------------------------------------------------------
import type { FitnessStats, QuestDef, SkillId } from './types'

export const LEVEL_CAP = 100
export const LEVEL_FLOOR_MARGIN = 15 // you can never fall further than (peak - 15)

// XP needed to go from `level` to `level + 1`.
// Calibrated so that lvl10 -> 213xp, lvl25 -> 671xp, lvl50 -> 1595xp,
// lvl60 -> 2004xp, lvl90 -> 3326xp.
export function xpToNext(level: number): number {
  return Math.round(12 * Math.pow(level, 1.25))
}

// Daily "upkeep" - XP you must earn in a skill just to stand still.
// Calibrated so that lvl10 -> 4xp/day, lvl25 -> 14, lvl50 -> 33, lvl60 -> 42,
// lvl90 -> 69xp/day. Grows faster than the pace you can realistically earn,
// which is what makes standing still at a high level require real effort.
export function dailyUpkeep(level: number): number {
  return Math.round(0.2 * Math.pow(level, 1.3))
}

// Extra multiplier applied to upkeep while the "Простой" (idle) debuff is
// active (7-day activity rating below IDLE_THRESHOLD). This is what makes
// levels fall even on a day where you technically did a little bit.
export const IDLE_ACTIVITY_THRESHOLD = 25
export const IDLE_UPKEEP_MULTIPLIER = 1.4

// 7-day rolling XP target that maps to 100 on the activity dial.
export const ACTIVITY_TARGET_7D = 1400

// 14-day rolling XP target that maps to 100 on the fitness "regularity" half.
export const FITNESS_REGULARITY_TARGET_14D = 450

export const FITNESS_ACTIVITY_XP = {
  strength: 50, // per session
  cardio: 35, // per session (includes "10k steps" days)
  steps10k: 20,
  stretch: 15,
} as const

// Skill-track XP for the manual daily log: hours * perHour, capped per day so a
// single heroic day can't spike a skill (the "кап на переработку"). Shared by
// LOG_MANUAL (actions.ts) and the Telegram parser prompt (api/telegram.ts) so
// the rates never drift between the two.
export const MANUAL_XP = {
  pm: { perHour: 15, hoursCap: 6 },
  productStudy: { perHour: 30, hoursCap: 3 },
  productPractice: { perHour: 60, hoursCap: 2 },
} as const

// Calorie corridor - edit these two numbers once you know your real target.
// Hitting the corridor pays out; missing it does nothing (no punishment for
// undereating - the point is to build the habit, not to police restriction).
export const CALORIE_CORRIDOR = { min: 2050, max: 2250 }
export const CALORIE_CORRIDOR_XP = 30
export const SLEEP_GOOD_RANGE = { min: 7, max: 9 }
export const SLEEP_GOOD_XP = 20

// Piecewise-linear interpolation through anchor points, clamped at the ends.
function interpolate(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return last[1]
}

const PULLUP_CURVE: [number, number][] = [
  [0, 0],
  [5, 15],
  [20, 50],
  [30, 72],
  [40, 90],
]

const PUSHUP_CURVE: [number, number][] = [
  [0, 0],
  [15, 15],
  [60, 50],
  [90, 72],
  [120, 90],
]

// Body fat %, lower is a higher score.
const BODYFAT_CURVE: [number, number][] = [
  [30, 0],
  [22, 28],
  [15, 60],
  [10, 86],
  [6, 100],
]

export function bodyScore(stats: FitnessStats): number {
  const parts: number[] = []
  if (stats.pullups > 0 || stats.pullups === 0) parts.push(interpolate(PULLUP_CURVE, stats.pullups))
  if (stats.pushups > 0) parts.push(interpolate(PUSHUP_CURVE, stats.pushups))
  if (stats.bodyFatPct > 0) parts.push(interpolate(BODYFAT_CURVE, stats.bodyFatPct))
  if (parts.length === 0) return 0
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
}

export function regularityScore(sum14d: number): number {
  return clamp(Math.round((sum14d / FITNESS_REGULARITY_TARGET_14D) * 100), 0, 100)
}

export function fitnessLevel(sum14d: number, stats: FitnessStats): number {
  return clamp(Math.round(0.5 * regularityScore(sum14d) + 0.5 * bodyScore(stats)), 1, LEVEL_CAP)
}

// The 7-day activity target scales with how long the journal has existed, so a
// fresh log isn't unfairly flagged as idle. `daysOfHistory` is min(7, days from
// the first journal entry to today inclusive): the target is 200 XP on day 1,
// 400 on day 2, ... and the full 1400 once the journal is 7+ days old (which is
// the default, so past the cold-start window this behaves exactly as before).
export function activityRating(sum7d: number, daysOfHistory = 7): number {
  const span = clamp(Math.round(daysOfHistory), 1, 7)
  const target = ACTIVITY_TARGET_7D * (span / 7)
  return clamp(Math.round((sum7d / target) * 100), 0, 100)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Overall hero level: weighted composite of the 1-100 sub-levels.
export const HERO_WEIGHTS: Record<SkillId | 'fitness' | 'activity', number> = {
  pm: 0.3,
  product: 0.25,
  fitness: 0.2,
  discipline: 0.15,
  activity: 0.1,
}

export function heroLevel(levels: {
  pm: number
  product: number
  fitness: number
  discipline: number
  activityRating: number
}): number {
  const v =
    levels.pm * HERO_WEIGHTS.pm +
    levels.product * HERO_WEIGHTS.product +
    levels.fitness * HERO_WEIGHTS.fitness +
    levels.discipline * HERO_WEIGHTS.discipline +
    levels.activityRating * HERO_WEIGHTS.activity
  return clamp(Math.round(v), 1, LEVEL_CAP)
}

// Career (avatar outfit) threshold - matches the "office" sprite unlocking
// once Product Management crosses this level.
export const OFFICE_OUTFIT_LEVEL = 25

export const DEFAULT_SKILL_META: Record<SkillId, { name: string; icon: string }> = {
  pm: { name: 'Project Management', icon: '💼' },
  product: { name: 'Product Management', icon: '🧠' },
  discipline: { name: 'Дисциплина', icon: '🔥' },
}

// Default 21-day sprint - matches "Спринт 1: Вход в продукт" from planning.
export const DEFAULT_QUESTS: QuestDef[] = [
  { id: 'wake', label: 'Подъём до 7:00', icon: '⏰', target: 14, xpPerTick: 25, reward: 'discipline' },
  { id: 'course', label: '45 минут курса по продакту', icon: '📘', target: 15, xpPerTick: 30, reward: 'product' },
  { id: 'workout', label: 'Любая тренировка', icon: '🏋️', target: 12, xpPerTick: 50, reward: 'fitness' },
  { id: 'case', label: 'Разбор продуктового кейса', icon: '🧩', target: 6, xpPerTick: 60, reward: 'product' },
  { id: 'calories', label: 'День в коридоре калорий', icon: '🥗', target: 15, xpPerTick: 30, reward: 'discipline' },
]

export const SPRINT_LENGTH_DAYS = 21
