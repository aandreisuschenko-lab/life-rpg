import street from '../assets/avatar/street.png'
import office from '../assets/avatar/office.png'

export function AvatarPanel({
  officeUnlocked,
  activityRating,
  frozen,
}: {
  officeUnlocked: boolean
  activityRating: number
  frozen: boolean
}) {
  const dim = activityRating < 40
  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 aspect-[2/3] max-w-[280px] mx-auto">
      <img
        src={officeUnlocked ? office : street}
        alt="avatar"
        className="w-full h-full object-cover transition-all duration-700"
        style={{
          filter: `saturate(${dim ? 0.35 : 1}) brightness(${dim ? 0.6 : 1}) ${frozen ? 'hue-rotate(180deg) saturate(0.5)' : ''}`,
        }}
      />
      {frozen && (
        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
          <span className="text-4xl">❄️</span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-center">
        <p className="text-xs text-slate-300">
          {officeUnlocked ? 'Образ: офисный' : 'Образ: уличный · офисный откроется на 25 ур. Product'}
        </p>
      </div>
    </div>
  )
}
