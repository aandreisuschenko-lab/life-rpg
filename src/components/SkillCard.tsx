import type { SkillState } from '../engine/types'
import { dailyUpkeep, xpToNext } from '../engine/rules'

export function SkillCard({ skill, floor }: { skill: SkillState; floor: number }) {
  const rusted = skill.level <= floor + 2
  const upkeep = dailyUpkeep(skill.level)
  const need = xpToNext(skill.level)
  return (
    <div className={`rounded-2xl border p-4 ${rusted ? 'border-orange-800/50 bg-orange-950/10' : 'border-slate-700/60 bg-slate-900/60'}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{skill.icon} {skill.name}</span>
        <span className="text-sm text-slate-400">ур. {skill.level}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 mt-2 overflow-hidden">
        <div className="h-full bg-violet-500" style={{ width: `${(skill.xp / need) * 100}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-500 mt-1">
        <span>{Math.round(skill.xp)}/{need} XP до следующего</span>
        <span>содержание {upkeep} XP/день</span>
      </div>
      {rusted && <p className="text-[11px] text-orange-400 mt-1">Близко ко дну (пик {skill.peakLevel} − 15)</p>}
    </div>
  )
}
