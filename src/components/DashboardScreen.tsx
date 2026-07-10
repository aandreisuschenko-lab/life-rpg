import { useRef } from 'react'
import { useGame } from '../engine/store'
import { deriveView } from '../engine/engine'
import { SkillCard } from './SkillCard'
import { FitnessPanel } from './FitnessPanel'
import { DayLogForm } from './DayLogForm'
import { HistoryCharts } from './HistoryCharts'

export function DashboardScreen() {
  const { state, exportSave, importSave } = useGame()
  const d = deriveView(state)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      <h2 className="text-xl font-bold">Дашборд</h2>

      <div className="space-y-3">
        <SkillCard skill={state.skills.pm} floor={d.floors.pm} />
        <SkillCard skill={state.skills.product} floor={d.floors.product} />
        <SkillCard skill={state.skills.discipline} floor={d.floors.discipline} />
      </div>

      <FitnessPanel />
      <DayLogForm />
      <HistoryCharts />

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 flex gap-2">
        <button onClick={exportSave} className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm py-2">
          ⬇️ Скачать сохранение
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm py-2">
          ⬆️ Загрузить
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importSave(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
