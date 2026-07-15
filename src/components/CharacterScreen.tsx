import { useGame } from '../engine/store'
import { deriveView } from '../engine/engine'
import { AvatarPanel } from './AvatarPanel'
import { Ring } from './Ring'
import { QuestList } from './QuestList'

const ATTR_COLORS: Record<string, string> = {
  pm: '#38bdf8',
  product: '#a78bfa',
  discipline: '#f97316',
}

const SYNC_LABEL: Record<string, string> = {
  idle: '',
  syncing: '🔄 синхронизация…',
  synced: '☁️ синхронизировано',
  error: '⚠️ офлайн (не синхронизировано)',
  offline: '',
}

export function CharacterScreen() {
  const { state, dispatch, syncEnabled, syncStatus } = useGame()
  const d = deriveView(state)

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Общий уровень героя</p>
          <p className="text-3xl font-bold">{d.heroLevel}<span className="text-slate-500 text-base">/100</span></p>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FREEZE' })}
          className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
            state.frozen ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          {state.frozen ? '❄️ Заморожено' : 'Заморозить'}
        </button>
      </div>

      {syncEnabled && SYNC_LABEL[syncStatus] && (
        <p className="text-center text-[11px] text-slate-500">{SYNC_LABEL[syncStatus]}</p>
      )}

      <AvatarPanel officeUnlocked={d.officeUnlocked} activityRating={d.activityRating} frozen={state.frozen} />

      <div className="flex justify-center gap-4">
        <Ring value={d.activityRating} label={`${d.activityRating}`} sub="Активность 7д" color={d.idleActive ? '#ef4444' : '#22c55e'} size={84} />
        <Ring value={d.fitnessLevel} label={`${d.fitnessLevel}`} sub="Форма" color="#38bdf8" size={84} />
      </div>

      {d.idleActive && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          ⚠️ Активность за 7 дней ниже {25} — включён дебафф «Простой»: содержание навыков списывается быстрее.
        </div>
      )}

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 mb-1">Атрибуты</h3>
        {(['pm', 'product', 'discipline'] as const).map((id) => {
          const s = state.skills[id]
          const floor = d.floors[id]
          return (
            <div key={id}>
              <div className="flex justify-between text-sm">
                <span>{s.icon} {s.name}</span>
                <span className="text-slate-400">
                  ур. {s.level} <span className="text-slate-600">(пик {s.peakLevel}, дно {floor})</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 mt-1 overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${s.level}%`, background: ATTR_COLORS[id] }} />
              </div>
            </div>
          )
        })}
      </div>

      <QuestList />

      <p className="text-center text-[11px] text-slate-500">Сегодня заработано: +{Math.round(d.todayGrossTotal)} XP</p>
    </div>
  )
}
