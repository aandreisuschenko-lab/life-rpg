// Telegram webhook -> parse the day with Gemini -> append it to data/days.json
// via the GitHub Contents API -> reply with a replay() summary.
//
// No database: the journal in the repo stays the single source of truth (same
// model as the app). Reuses the game engine directly (replay/deriveView) and
// the same balance constants the app uses, so XP never drifts. Deployed as a
// Vercel Serverless Function; Vercel builds api/* on its own (it is not part of
// `npm run build`, which only bundles the client).
import { replay, deriveView } from '../src/engine/engine.js'
import {
  CALORIE_CORRIDOR,
  CALORIE_CORRIDOR_XP,
  DEFAULT_QUESTS,
  FITNESS_ACTIVITY_XP,
  IDLE_UPKEEP_MULTIPLIER,
  MANUAL_XP,
  SLEEP_GOOD_RANGE,
  SLEEP_GOOD_XP,
  dailyUpkeep,
} from '../src/engine/rules.js'
import type { DayRecord, GameState, SkillId } from '../src/engine/types.js'

const TELEGRAM_API = 'https://api.telegram.org'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const JOURNAL_PATH = 'data/days.json'
const SKILL_NAMES: Record<SkillId, string> = { pm: 'PM', product: 'Product', discipline: 'Дисциплина' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // Telegram retries on any non-2xx, so we always answer 200. Errors are
  // reported into the chat instead of being swallowed (see catch).
  const chatId = req?.body?.message?.chat?.id ?? req?.body?.edited_message?.chat?.id
  try {
    if (req.method !== 'POST') {
      res.status(200).json({ ok: true })
      return
    }

    const message = req.body?.message ?? req.body?.edited_message
    if (!message || chatId == null) {
      res.status(200).json({ ok: true })
      return
    }

    // Personal bot: anyone but the owner is ignored silently.
    if (chatId !== Number(process.env.ALLOWED_CHAT_ID)) {
      res.status(200).json({ ok: true })
      return
    }

    // Voice/audio not supported.
    if (message.voice || message.audio || message.video_note) {
      await sendMessage(chatId, 'Пришли текстом')
      res.status(200).json({ ok: true })
      return
    }

    const text = String(message.text ?? '').trim()
    if (!text) {
      res.status(200).json({ ok: true })
      return
    }
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, 'Опиши день обычным текстом — разберу и запишу в журнал. Голосовые не читаю.')
      res.status(200).json({ ok: true })
      return
    }

    const record = await parseDay(text)
    const days = await upsertDay(record)

    const before = replay(days.filter((d) => d.date !== record.date))
    const after = replay(days)
    await sendMessage(chatId, summarize(record, before, after))
    res.status(200).json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Only report back to the owner; never leak errors to strangers.
    if (chatId != null && chatId === Number(process.env.ALLOWED_CHAT_ID)) {
      try {
        await sendMessage(chatId, `Ошибка: ${msg}`)
      } catch {
        // If even the report fails there is nothing more we can do here.
      }
    }
    res.status(200).json({ ok: false, error: msg })
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`переменная окружения ${name} не задана`)
  return v
}

// yyyy-mm-dd for "today" in Asia/Almaty (UTC+5, no DST).
function todayAlmaty(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = requireEnv('TELEGRAM_TOKEN')
  const r = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!r.ok) throw new Error(`Telegram sendMessage ${r.status}: ${await r.text()}`)
}

// The parser prompt is built from the very same balance constants the game
// uses, so the model can never invent rates that disagree with the engine.
function buildSystemPrompt(today: string): string {
  const workouts = Object.entries(FITNESS_ACTIVITY_XP)
    .map(([k, v]) => `${k} +${v}`)
    .join(', ')
  const quests = DEFAULT_QUESTS.map((q) => `- ${q.id}: «${q.label}» (награда: ${q.reward})`).join('\n')

  return [
    'Ты парсер дневника игры Life RPG. На вход — свободный текст о прошедшем дне на русском.',
    'Верни СТРОГО один JSON-объект (DayRecord), без markdown, без пояснений, без ``` .',
    '',
    'Схема DayRecord:',
    '{ "date": string, "note": string, "xp": { "pm": number, "prod": number, "disc": number },',
    '  "fit": number, "quests": { [questId: string]: number }, "sleep": number, "calories": number, "mood": number }',
    '',
    `date всегда = "${today}" (сегодня по Asia/Almaty), не меняй.`,
    'Все числовые поля — итоговый gross-XP или показатель за день; неизвестное ставь 0 (для xp/fit) или опускай (sleep/calories/mood).',
    '',
    'Ставки XP (бери отсюда, не выдумывай):',
    `- pm: ${MANUAL_XP.pm.perHour} XP за час работы PM, не больше ${MANUAL_XP.pm.hoursCap} ч/день.`,
    `- prod: теория ${MANUAL_XP.productStudy.perHour} XP/ч (кап ${MANUAL_XP.productStudy.hoursCap} ч), практика ${MANUAL_XP.productPractice.perHour} XP/ч (кап ${MANUAL_XP.productPractice.hoursCap} ч). Сложи их в prod.`,
    `- fit: тренировка даёт XP по типу — ${workouts}. За день берётся один максимальный тип.`,
    `- disc: сон ${SLEEP_GOOD_RANGE.min}–${SLEEP_GOOD_RANGE.max} ч даёт +${SLEEP_GOOD_XP}; калории в коридоре ${CALORIE_CORRIDOR.min}–${CALORIE_CORRIDOR.max} дают +${CALORIE_CORRIDOR_XP}.`,
    '',
    'Показатели дня: sleep — часы сна (число), calories — ккал (число), mood — настроение 1..5.',
    'note — короткая (до ~40 симв.) человеческая пометка о дне.',
    '',
    'Квесты спринта (для поля quests укажи, сколько раз квест выполнен сегодня, обычно 0 или 1):',
    quests,
    'Поле quests двигает только прогресс спринта и НЕ добавляет XP сверх ставок выше — XP уже посчитан в xp/fit.',
  ].join('\n')
}

async function parseDay(text: string): Promise<DayRecord> {
  const key = requireEnv('GEMINI_API_KEY')
  const today = todayAlmaty()
  const r = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildSystemPrompt(today) }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  })
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await r.json()) as any
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof raw !== 'string') {
    throw new Error(`Gemini вернул пустой ответ: ${JSON.stringify(data).slice(0, 400)}`)
  }

  // The response should already be pure JSON, but strip a ```json fence just in case.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Модель вернула не JSON: ${cleaned.slice(0, 400)}`)
  }
  return normalizeRecord(parsed, today)
}

// Trust nothing from the model: coerce types, force today's date, default the
// XP fields to 0 so a malformed field can never crash replay.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRecord(raw: any, today: string): DayRecord {
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const xp = raw?.xp ?? {}
  const quests: Record<string, number> = {}
  if (raw?.quests && typeof raw.quests === 'object') {
    for (const [k, v] of Object.entries(raw.quests)) {
      const n = num(v)
      if (n) quests[k] = n
    }
  }
  return {
    date: today,
    note: raw?.note != null ? String(raw.note).slice(0, 80) : undefined,
    xp: { pm: num(xp.pm) ?? 0, prod: num(xp.prod) ?? 0, disc: num(xp.disc) ?? 0 },
    fit: num(raw?.fit) ?? 0,
    quests,
    sleep: num(raw?.sleep),
    calories: num(raw?.calories),
    mood: num(raw?.mood),
  }
}

function commitMessage(r: DayRecord): string {
  const parts: string[] = []
  if (r.xp?.pm) parts.push(`PM +${r.xp.pm}`)
  if (r.xp?.prod) parts.push(`PROD +${r.xp.prod}`)
  if (r.xp?.disc) parts.push(`DISC +${r.xp.disc}`)
  if (r.fit) parts.push(`FIT +${r.fit}`)
  return `День ${r.date}: ${parts.length ? parts.join(', ') : 'без XP'}`
}

// Read data/days.json from GitHub, upsert the record by date, write it back.
async function upsertDay(record: DayRecord): Promise<DayRecord[]> {
  const repo = requireEnv('GITHUB_REPO')
  const token = requireEnv('GITHUB_TOKEN')
  const url = `https://api.github.com/repos/${repo}/contents/${JOURNAL_PATH}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'life-rpg-bot',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const getRes = await fetch(url, { headers })
  if (!getRes.ok) throw new Error(`GitHub GET ${getRes.status}: ${await getRes.text()}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const file = (await getRes.json()) as any
  const sha: string = file.sha
  const decoded = Buffer.from(String(file.content ?? '').replace(/\s/g, ''), 'base64').toString('utf8')

  let days: DayRecord[]
  try {
    const parsed = JSON.parse(decoded)
    days = Array.isArray(parsed) ? parsed : []
  } catch {
    days = []
  }

  // Replace an existing entry for the same date instead of duplicating it.
  days = days.filter((d) => d?.date !== record.date)
  days.push(record)
  days.sort((a, b) => a.date.localeCompare(b.date))

  const content = Buffer.from(JSON.stringify(days, null, 2) + '\n', 'utf8').toString('base64')
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: commitMessage(record), content, sha }),
  })
  if (!putRes.ok) throw new Error(`GitHub PUT ${putRes.status}: ${await putRes.text()}`)
  return days
}

// Dashboard-tone reply: no exclamation marks, just the numbers.
function summarize(record: DayRecord, before: GameState, after: GameState): string {
  const d = deriveView(after)
  const ids: SkillId[] = ['pm', 'product', 'discipline']

  const xpParts: string[] = []
  if (record.xp?.pm) xpParts.push(`PM +${record.xp.pm}`)
  if (record.xp?.prod) xpParts.push(`Product +${record.xp.prod}`)
  if (record.xp?.disc) xpParts.push(`Дисциплина +${record.xp.disc}`)
  if (record.fit) xpParts.push(`Форма +${record.fit}`)

  const levels = ids.map((id) => {
    const a = after.skills[id].level
    const delta = a - before.skills[id].level
    const change = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : ''
    return `${SKILL_NAMES[id]} ${a}${change}`
  })

  const upkeepMult = d.idleActive ? IDLE_UPKEEP_MULTIPLIER : 1
  const upkeep = ids.map((id) => `${SKILL_NAMES[id]} ${Math.round(dailyUpkeep(after.skills[id].level) * upkeepMult)}`)

  const questLines = Object.keys(record.quests ?? {})
    .map((qid) => after.quests.find((q) => q.id === qid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => `${q.label}: ${q.progress}/${q.target}`)

  const lines = [
    `День ${record.date}${record.note ? ` — ${record.note}` : ''}`,
    `XP: ${xpParts.length ? xpParts.join(', ') : 'нет'}`,
    `Уровни: ${levels.join(', ')}, Форма ${d.fitnessLevel}`,
    `Герой: ${d.heroLevel}, активность ${d.activityRating}/100${d.idleActive ? ' (простой)' : ''}`,
  ]
  if (questLines.length) lines.push(`Квесты: ${questLines.join(', ')}`)
  lines.push(`Содержание на завтра: ${upkeep.join(', ')}`)
  return lines.join('\n')
}
