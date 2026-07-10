import { useState } from 'react'
import { useGame } from '../engine/store'
import type { ManualLogPayload } from '../engine/store'

const WORKOUTS: { id: NonNullable<ManualLogPayload['workout']>; label: string }[] = [
  { id: 'none', label: '—' },
  { id: 'strength', label: 'Силовая (+50)' },
  { id: 'cardio', label: 'Кардио (+35)' },
  { id: 'steps10k', label: '10к шагов (+20)' },
  { id: 'stretch', label: 'Растяжка (+15)' },
]

export function DayLogForm() {
  const { state, dispatch } = useGame()
  const t = state.today
  const [pmHours, setPmHours] = useState('')
  const [studyHours, setStudyHours] = useState('')
  const [practiceHours, setPracticeHours] = useState('')
  const [workout, setWorkout] = useState<ManualLogPayload['workout']>('none')
  const [sleep, setSleep] = useState(t.sleepHours?.toString() ?? '')
  const [calories, setCalories] = useState(t.calories?.toString() ?? '')
  const [mood, setMood] = useState(t.mood ?? 3)
  const [note, setNote] = useState(t.note ?? '')

  const submit = () => {
    dispatch({
      type: 'LOG_MANUAL',
      payload: {
        pmHours: pmHours ? +pmHours : undefined,
        productStudyHours: studyHours ? +studyHours : undefined,
        productPracticeHours: practiceHours ? +practiceHours : undefined,
        workout,
        sleepHours: sleep ? +sleep : undefined,
        calories: calories ? +calories : undefined,
        mood,
        note: note || undefined,
      },
    })
    setPmHours('')
    setStudyHours('')
    setPracticeHours('')
    setWorkout('none')
  }

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
      <h3 className="font-semibold">📝 Итог дня</h3>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Часы PM</span>
          <input value={pmHours} onChange={(e) => setPmHours(e.target.value)} type="number" min="0" max="12"
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Часы теории</span>
          <input value={studyHours} onChange={(e) => setStudyHours(e.target.value)} type="number" min="0" max="6"
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Часы практики</span>
          <input value={practiceHours} onChange={(e) => setPracticeHours(e.target.value)} type="number" min="0" max="6"
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[11px] text-slate-400">Тренировка</span>
        <select value={workout} onChange={(e) => setWorkout(e.target.value as ManualLogPayload['workout'])}
          className="bg-slate-800 rounded-lg px-2 py-2 border border-slate-700">
          {WORKOUTS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Сон, ч (7–9 = +20)</span>
          <input value={sleep} onChange={(e) => setSleep(e.target.value)} type="number" step="0.5"
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Калории (коридор = +30)</span>
          <input value={calories} onChange={(e) => setCalories(e.target.value)} type="number"
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
      </div>

      <div>
        <span className="text-[11px] text-slate-400">Настроение</span>
        <div className="flex gap-2 mt-1">
          {[1, 2, 3, 4, 5].map((m) => (
            <button key={m} onClick={() => setMood(m)}
              className={`w-9 h-9 rounded-lg border text-lg ${mood === m ? 'border-violet-500 bg-violet-600/20' : 'border-slate-700'}`}>
              {['😞','😕','😐','🙂','😄'][m - 1]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[11px] text-slate-400">Заметка (в дневник, XP не влияет)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 resize-none" />
      </label>

      <button onClick={submit} className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2">
        Начислить за сегодня
      </button>
    </div>
  )
}
