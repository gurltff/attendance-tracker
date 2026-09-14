import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { AttendanceRecord, Course } from '../../types'
import {
  calcAttendanceMarks, calcAttendancePercent, classesNeededForTarget,
  formatMarksLabel, isShortage, MAX_MARKS_BY_CATEGORY,
} from '../../utils/attendanceMarks'
import AttendanceForecast from './AttendanceForecast'

const RING_TRACK = '#15130F1A'
const TINTS = ['tint-butter', 'tint-blush', 'tint-sage', 'tint-sky']

export default function Overview({ courses, records }: { courses: Course[]; records: AttendanceRecord[]; programName?: string; year?: string }) {
  const rows = courses.map((c) => {
    const forCourse = records.filter((r) => r.courseId === c.id)
    const present = forCourse.filter((r) => r.status === 'present').length
    const total = forCourse.length
    const percent = calcAttendancePercent(present, total)
    const maxMarks = c.maxAttendanceMarks ?? MAX_MARKS_BY_CATEGORY[c.category]
    const marks = calcAttendanceMarks(percent, maxMarks)
    const needed = classesNeededForTarget(present, total)
    return { course: c, present, total, percent, maxMarks, marks, needed }
  })

  const shortages = rows.filter((r) => r.total > 0 && isShortage(r.percent))

  return (
    <div className="space-y-4">
      {shortages.map((r) => (
        <div key={r.course.id} className="card-tint tint-blush text-ink text-sm font-medium">
          ⚠️ Your attendance in <span className="font-bold">{r.course.name}</span> is below 67% — attend more classes to avoid shortage.
        </div>
      ))}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r, i) => (
          <div key={r.course.id} className={`card-tint ${TINTS[i % TINTS.length]}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-ink">{r.course.name}</h3>
                <p className="text-xs text-ink/60">{r.course.code}</p>
              </div>
              <div className="w-16 h-16">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[{ value: r.percent }, { value: 100 - r.percent }]}
                      dataKey="value" innerRadius={20} outerRadius={30} startAngle={90} endAngle={-270}
                    >
                      <Cell fill={r.percent < 67 ? '#C0392B' : '#15130F'} />
                      <Cell fill={RING_TRACK} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-3xl font-extrabold mt-2 text-ink">{r.percent.toFixed(0)}%</p>
            <div className="w-full bg-cream-soft/70 border border-ink/30 rounded-full h-2 mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full ${r.percent < 67 ? 'bg-[#C0392B]' : 'bg-ink'}`}
                style={{ width: `${Math.min(100, r.percent)}%` }}
              />
            </div>
            <p className="text-xs text-ink/60 mt-1">{r.present} / {r.total} classes attended</p>
            <p className="text-xs mt-2 text-ink/80">{formatMarksLabel(r.percent, r.marks, r.maxMarks)}</p>
            <p className="text-xs mt-1 font-semibold text-ink">
              {r.needed > 0
                ? `You need to attend ${r.needed} more class${r.needed > 1 ? 'es' : ''} to reach 75%`
                : '✅ You are already at or above 75% attendance'}
            </p>
            <AttendanceForecast present={r.present} total={r.total} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-ink-muted">No enrolled courses yet.</p>}
      </div>
    </div>
  )
}