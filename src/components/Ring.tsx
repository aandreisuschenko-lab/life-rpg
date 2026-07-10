export function Ring({
  value,
  max = 100,
  size = 96,
  stroke = 9,
  color = '#8b5cf6',
  label,
  sub,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  label: string
  sub?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1f2740" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold leading-none">{label}</span>
        {sub && <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>}
      </div>
    </div>
  )
}
