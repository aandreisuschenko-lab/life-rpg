import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGame } from '../engine/store'

export function HistoryCharts() {
  const { state } = useGame()
  const days = [...state.history.slice(-30), state.today]

  const xpData = days.map((d) => ({
    date: d.date.slice(5),
    xp: Object.values(d.xpBySkill).reduce((a, b) => a + b, 0) + d.fitnessXp,
  }))

  const weightData = state.weightLog.slice(-30).map((w) => ({ date: w.date.slice(5), kg: w.weight }))

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-6">
      <div>
        <h3 className="font-semibold mb-2">📈 XP в день (30 дней)</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xpData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={30} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
              <Line type="monotone" dataKey="xp" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {weightData.length > 1 && (
        <div>
          <h3 className="font-semibold mb-2">⚖️ Вес, кг (тренд)</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={30} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
                <Line type="monotone" dataKey="kg" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
