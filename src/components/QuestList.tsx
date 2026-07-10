import { useGame } from '../engine/store'
import { addDays, todayStr } from '../engine/engine'
import { SPRINT_LENGTH_DAYS } from '../engine/rules'

export function QuestList() {
  const { state, dispatch } = useGame()
  const sprintEnd = addDays(state.sprintStart, SPRINT_LENGTH_DAYS)
  const dayOfSprint = Math.min(
    SPRINT_LENGTH_DAYS,
    Math.max(0, (new Date(todayStr()).getTime() - new Date(state.sprintStart).getTime()) / 86400000),
  )
  const sprintOver = todayStr() >= sprintEnd

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-100">Квесты спринта</h3>
        <span className="text-xs text-slate-400">
          день {Math.floor(dayOfSprint)}/{SPRINT_LENGTH_DAYS}
        </span>
      </div>
      <div className="space-y-2">
        {state.quests.map((q) => {
          const done = q.progress >= q.target
          const behindPace = q.progress < (q.target * dayOfSprint) / SPRINT_LENGTH_DAYS - 1
          return (
            <div
              key={q.id}
              className={`rounded-xl border p-3 flex items-center gap-3 ${
                done ? 'border-emerald-600/50 bg-emerald-900/20' : behindPace ? 'border-amber-700/50 bg-amber-900/10' : 'border-slate-700/50 bg-slate-800/40'
              }`}
            >
              <span className="text-xl">{q.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-100 truncate">{q.label}</p>
                <div className="h-1.5 rounded-full bg-slate-700 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all"
                    style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {q.progress}/{q.target} · +{q.xpPerTick} XP за раз
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => dispatch({ type: 'TAP_QUEST', id: q.id, delta: 1 })}
                  disabled={q.progress >= q.target}
                  className="w-8 h-8 rounded-lg bg-violet-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold active:scale-95 transition"
                >
                  +
                </button>
                <button
                  onClick={() => dispatch({ type: 'TAP_QUEST', id: q.id, delta: -1 })}
                  disabled={q.progress <= 0}
                  className="w-8 h-8 rounded-lg bg-slate-700/60 disabled:opacity-30 text-slate-300 text-sm active:scale-95 transition"
                >
                  −
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {sprintOver && (
        <button
          onClick={() => dispatch({ type: 'NEW_SPRINT' })}
          className="mt-3 w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2"
        >
          Спринт завершён → начать новый
        </button>
      )}
    </div>
  )
}
