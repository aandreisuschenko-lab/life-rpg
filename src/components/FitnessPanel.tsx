import { useState } from 'react'
import { useGame } from '../engine/store'
import { deriveView } from '../engine/engine'

export function FitnessPanel() {
  const { state, dispatch } = useGame()
  const d = deriveView(state)
  const [f, setF] = useState(state.fitness)

  const save = () => dispatch({ type: 'UPDATE_FITNESS_STATS', stats: f })

  const lastWeight = state.weightLog[state.weightLog.length - 1]?.weight ?? f.weightKg
  const weekAgo = state.weightLog.filter((w) => w.date <= state.today.date).slice(-7)
  const trend = weekAgo.length > 1 ? weekAgo[weekAgo.length - 1].weight - weekAgo[0].weight : 0

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">💪 Форма</h3>
        <span className="text-sm text-slate-400">уровень {d.fitnessLevel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
        <div>Регулярность (14д): <span className="text-slate-200">{d.regularityScore}/100</span></div>
        <div>Тело и результаты: <span className="text-slate-200">{d.bodyScore}/100</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Подтягивания</span>
          <input type="number" value={f.pullups} onChange={(e) => setF({ ...f, pullups: +e.target.value })}
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">Отжимания</span>
          <input type="number" value={f.pushups} onChange={(e) => setF({ ...f, pushups: +e.target.value })}
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">% жира</span>
          <input type="number" value={f.bodyFatPct} onChange={(e) => setF({ ...f, bodyFatPct: +e.target.value })}
            className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[11px] text-slate-400">Вес, кг (тренд, не даёт XP)</span>
        <input type="number" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: +e.target.value })}
          className="bg-slate-800 rounded-lg px-2 py-1 border border-slate-700" />
      </label>
      <p className="text-[11px] text-slate-500">
        Сейчас: {lastWeight} кг {trend !== 0 && <span className={trend < 0 ? 'text-emerald-400' : 'text-orange-400'}>({trend > 0 ? '+' : ''}{trend.toFixed(1)} кг за неделю)</span>}
      </p>
      <button onClick={save} className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2">
        Сохранить показатели формы
      </button>
    </div>
  )
}
