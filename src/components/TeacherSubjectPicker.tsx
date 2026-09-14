import { useState } from 'react'
import { SCHEDULE_DATA, YEAR_ORDER, getProgramCourses, makeCourseKey, parseCourseKey } from '../data/scheduleData'

const AVAILABLE_PROGRAMS = Object.keys(SCHEDULE_DATA)

export default function TeacherSubjectPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (keys: string[]) => void
}) {
  const firstParsed = value[0] ? parseCourseKey(value[0]) : null
  const [program, setProgram] = useState<string>(firstParsed?.programName ?? '')

  const [pickedYears, setPickedYears] = useState<string[]>(
    Array.from(new Set(value.filter((k) => parseCourseKey(k).programName === (firstParsed?.programName ?? '')).map((k) => parseCourseKey(k).year)))
  )

  const availableYears = program && SCHEDULE_DATA[program]
    ? YEAR_ORDER.filter((y) => Object.keys(SCHEDULE_DATA[program].years).includes(y))
    : []

  function toggleYear(year: string) {
    const isPicked = pickedYears.includes(year)
    if (isPicked) {
      setPickedYears((y) => y.filter((yr) => yr !== year))
      onChange(value.filter((k) => !(parseCourseKey(k).programName === program && parseCourseKey(k).year === year)))
    } else {
      setPickedYears((y) => [...y, year])
    }
  }

  function toggleCourse(year: string, course: string) {
    const key = makeCourseKey(program, year, course)
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key))
    } else {
      onChange([...value, key])
    }
  }

  function changeProgram(p: string) {
    setProgram(p)
    setPickedYears([])
    onChange([])
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Your programme / department</label>
        <div className="flex flex-col gap-2 mt-1">
          {AVAILABLE_PROGRAMS.map((p) => (
            <label
              key={p}
              className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer transition ${
                program === p ? 'border-brand-blue bg-brand-blue/10' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <input type="radio" name="teacher-program" checked={program === p} onChange={() => changeProgram(p)} />
              {p}
            </label>
          ))}
        </div>
      </div>

      {program && (
        <div>
          <label className="text-sm font-medium">Which year(s) do you teach?</label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Pick every year whose students you take classes for — you can select more than one.
          </p>
          <div className="flex flex-wrap gap-2">
            {availableYears.map((y) => (
              <label
                key={y}
                className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer transition ${
                  pickedYears.includes(y) ? 'border-brand-blue bg-brand-blue/10' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input type="checkbox" checked={pickedYears.includes(y)} onChange={() => toggleYear(y)} />
                {y}
              </label>
            ))}
          </div>
        </div>
      )}

      {program && pickedYears.map((year) => {
        const courses = getProgramCourses(program, year)
        return (
          <div key={year} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <p className="text-sm font-medium mb-2">{program} · {year} — select your subject(s)</p>
            <div className="grid grid-cols-2 gap-2">
              {courses.map((c) => {
                const key = makeCourseKey(program, year, c.name)
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={value.includes(key)} onChange={() => toggleCourse(year, c.name)} />
                    {c.name}
                  </label>
                )
              })}
              {courses.length === 0 && <p className="text-xs text-slate-500">No timetable loaded for this year yet.</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}