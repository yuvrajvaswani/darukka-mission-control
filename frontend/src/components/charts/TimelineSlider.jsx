import { useState, useEffect, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'

// 24-month window ending today — computed once at module load
export const TIMELINE_MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - (23 - i))
  return d.toISOString().slice(0, 7)
})

function formatLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

const PLAY_INTERVAL_MS = 750

export default function TimelineSlider() {
  const [index, setIndex]     = useState(TIMELINE_MONTHS.length - 1)
  const [playing, setPlaying] = useState(false)
  const setTimelineDate       = useMapStore((s) => s.setTimelineDate)
  const intervalRef           = useRef(null)

  // Sync store whenever index changes
  useEffect(() => {
    setTimelineDate(TIMELINE_MONTHS[index])
  }, [index, setTimelineDate])

  // Auto-advance when playing
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setIndex((i) => {
          if (i >= TIMELINE_MONTHS.length - 1) {
            setPlaying(false)
            return i
          }
          return i + 1
        })
      }, PLAY_INTERVAL_MS)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [playing])

  const pct = (index / (TIMELINE_MONTHS.length - 1)) * 100

  // Year boundary ticks
  const yearMarkers = TIMELINE_MONTHS.reduce((acc, m, i) => {
    if (m.slice(5) === '01') acc.push({ i, year: m.slice(0, 4) })
    return acc
  }, [])

  const prev = () => { setPlaying(false); setIndex((i) => Math.max(0, i - 1)) }
  const next = () => { setPlaying(false); setIndex((i) => Math.min(TIMELINE_MONTHS.length - 1, i + 1)) }

  return (
    <div
      className="bg-surface-800/95 border border-surface-600/70 rounded-2xl shadow-2xl backdrop-blur-md
                 px-5 pt-3.5 pb-4 select-none"
      style={{ minWidth: 380, maxWidth: 560 }}
    >
      {/* ── Top row ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3.5">

        {/* Play / Pause */}
        <button
          onClick={() => setPlaying((p) => !p)}
          className="w-8 h-8 flex-shrink-0 rounded-full bg-brand-600 hover:bg-brand-500
                     active:scale-90 transition-all duration-150 flex items-center justify-center
                     shadow-lg shadow-brand-900/60 focus:outline-none focus:ring-2
                     focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-800"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            /* Pause icon */
            <svg className="w-3 h-3 text-white" viewBox="0 0 10 14" fill="currentColor">
              <rect x="0" y="0" width="3" height="14" rx="1" />
              <rect x="7" y="0" width="3" height="14" rx="1" />
            </svg>
          ) : (
            /* Play icon */
            <svg className="w-3.5 h-3.5 text-white translate-x-px" viewBox="0 0 12 14" fill="currentColor">
              <path d="M1 1l10 6-10 6V1z" />
            </svg>
          )}
        </button>

        {/* Calendar pip */}
        <svg className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>

        {/* Animated date label */}
        <span
          key={TIMELINE_MONTHS[index]}
          className="flex-1 text-sm font-semibold text-white tracking-tight animate-fade-in"
        >
          {formatLabel(TIMELINE_MONTHS[index])}
        </span>

        {/* Playing indicator dots */}
        {playing && (
          <span className="flex gap-1 mr-1">
            {[0, 0.15, 0.3].map((delay, d) => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </span>
        )}

        {/* Step buttons */}
        <div className="flex gap-1">
          <button
            onClick={prev}
            disabled={index === 0}
            className="w-6 h-6 rounded-md bg-surface-700 hover:bg-surface-600 disabled:opacity-30
                       flex items-center justify-center text-gray-400 hover:text-white
                       transition-colors duration-100"
            aria-label="Previous month"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            disabled={index === TIMELINE_MONTHS.length - 1}
            className="w-6 h-6 rounded-md bg-surface-700 hover:bg-surface-600 disabled:opacity-30
                       flex items-center justify-center text-gray-400 hover:text-white
                       transition-colors duration-100"
            aria-label="Next month"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Slider track ───────────────────────────────────────────────── */}
      <div className="relative px-0">

        {/* Floating date pill above thumb */}
        <div
          className="absolute -top-6 pointer-events-none transition-[left] duration-100 ease-out"
          style={{ left: `clamp(18px, calc(${pct}% ), calc(100% - 18px))`, transform: 'translateX(-50%)' }}
        >
          <div className="bg-brand-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md
                          shadow-lg shadow-brand-900/50 whitespace-nowrap">
            {TIMELINE_MONTHS[index]}
          </div>
          {/* Arrow */}
          <div className="w-0 h-0 mx-auto mt-px"
               style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #0f8062' }} />
        </div>

        <input
          type="range"
          min={0}
          max={TIMELINE_MONTHS.length - 1}
          value={index}
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); prev() }
            if (e.key === 'ArrowRight') { e.preventDefault(); next() }
          }}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer outline-none
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-brand-400
                     [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(58,186,142,0.7)]
                     [&::-webkit-slider-thumb]:cursor-grab
                     [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb:active]:scale-125
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-400
                     [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
          style={{
            background: `linear-gradient(to right, #1a9f76 0%, #3aba8e ${pct}%, #213329 ${pct}%, #213329 100%)`,
          }}
        />

        {/* Year tick marks */}
        <div className="relative h-5 mt-1.5">
          {yearMarkers.map(({ i, year }) => {
            const tickPct = (i / (TIMELINE_MONTHS.length - 1)) * 100
            return (
              <button
                key={year}
                onClick={() => { setPlaying(false); setIndex(i) }}
                className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5 group"
                style={{ left: `${tickPct}%` }}
              >
                <div className="w-px h-1.5 bg-surface-500 group-hover:bg-brand-500 transition-colors" />
                <span className="text-[9px] font-mono text-gray-600 group-hover:text-brand-400 transition-colors leading-none">
                  {year}
                </span>
              </button>
            )
          })}

          {/* Month count badges at ends */}
          <span className="absolute left-0 top-2 text-[9px] text-gray-700 font-mono">
            {TIMELINE_MONTHS[0].slice(5)}&#39;{TIMELINE_MONTHS[0].slice(2, 4)}
          </span>
          <span className="absolute right-0 top-2 text-[9px] text-gray-700 font-mono">
            {TIMELINE_MONTHS[TIMELINE_MONTHS.length - 1].slice(5)}&#39;{TIMELINE_MONTHS[TIMELINE_MONTHS.length - 1].slice(2, 4)}
          </span>
        </div>
      </div>
    </div>
  )
}
