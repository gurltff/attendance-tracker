import { useState } from 'react'
import {
  forecastAttendancePercent,
  maxMissableClasses,
  MINIMUM_ATTENDANCE_PERCENT,
  TARGET_ATTENDANCE_PERCENT,
} from '../../utils/attendanceMarks'

/*
 * "If I miss N more classes, what will my attendance be?"
 *
 * Lets a student plug in how many classes are left this term
 * and how many of those they expect to skip, and instantly
 * see the projected percentage — plus the max they can safely
 * miss and stay above the 67% minimum.
 */

export default function AttendanceForecast({
  present,
  total,
}: {
  present: number
  total: number
}) {
  const [upcoming, setUpcoming] = useState(10)
  const [miss, setMiss] = useState(0)

  const clampedMiss = Math.min(
    Math.max(0, miss),
    Math.max(0, upcoming)
  )

  const forecastPercent = forecastAttendancePercent(
    present,
    total,
    upcoming,
    clampedMiss
  )

  const safeToMiss = maxMissableClasses(
    present,
    total,
    upcoming
  )

  const belowMinimum =
    forecastPercent < MINIMUM_ATTENDANCE_PERCENT

  const belowTarget =
    forecastPercent < TARGET_ATTENDANCE_PERCENT

  return (
    <details className="mt-3 group">
      <summary className="text-xs font-semibold text-ink/70 cursor-pointer select-none">
        📉 Forecast: what if I miss more classes?
      </summary>

      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="block text-ink/60 mb-0.5">
              Classes left
            </span>
            <input
              type="number"
              min={0}
              className="input text-sm py-1"
              value={upcoming}
              onChange={(event) =>
                setUpcoming(
                  Math.max(
                    0,
                    Number(event.target.value) || 0
                  )
                )
              }
            />
          </label>

          <label className="text-xs">
            <span className="block text-ink/60 mb-0.5">
              You'll miss
            </span>
            <input
              type="number"
              min={0}
              max={upcoming}
              className="input text-sm py-1"
              value={clampedMiss}
              onChange={(event) =>
                setMiss(
                  Math.max(
                    0,
                    Number(event.target.value) || 0
                  )
                )
              }
            />
          </label>
        </div>

        <p
          className={`text-sm font-bold ${
            belowMinimum
              ? 'text-[#C0392B]'
              : belowTarget
                ? 'text-ink'
                : 'text-ink'
          }`}
        >
          Projected attendance: {forecastPercent.toFixed(1)}%
        </p>

        {belowMinimum ? (
          <p className="text-xs text-[#C0392B] font-medium">
            ⚠️ That would put you below the 67% minimum
            (shortage).
          </p>
        ) : belowTarget ? (
          <p className="text-xs text-ink/70">
            Above the 67% minimum, but below the 75% target.
          </p>
        ) : (
          <p className="text-xs text-ink/70">
            ✅ Still at or above the 75% target.
          </p>
        )}

        <p className="text-xs text-ink/60">
          Out of the next {upcoming} class
          {upcoming === 1 ? '' : 'es'}, you can safely miss up
          to{' '}
          <span className="font-semibold text-ink">
            {safeToMiss}
          </span>{' '}
          and stay at/above 67%.
        </p>
      </div>
    </details>
  )
}
