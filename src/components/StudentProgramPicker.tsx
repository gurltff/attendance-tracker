import { SCHEDULE_DATA, YEAR_ORDER } from '../data/scheduleData'

const AVAILABLE_PROGRAMS = Object.keys(SCHEDULE_DATA)

export default function StudentProgramPicker({
  program,
  year,
  onProgramChange,
  onYearChange,
}: {
  program: string
  year: string
  onProgramChange: (p: string) => void
  onYearChange: (y: string) => void
}) {
  const availableYears = program && SCHEDULE_DATA[program]
    ? YEAR_ORDER.filter((y) => Object.keys(SCHEDULE_DATA[program].years).includes(y))
    : []

  function changeProgram(p: string) {
    onProgramChange(p)
    onYearChange('')
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
              <input type="radio" name="student-program" checked={program === p} onChange={() => changeProgram(p)} />
              {p}
            </label>
          ))}
        </div>
      </div>

      {program && (
        <div>
          <label className="text-sm font-medium">Which year are you in?</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {availableYears.map((y) => (
              <label
                key={y}
                className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer transition ${
                  year === y ? 'border-brand-blue bg-brand-blue/10' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input type="radio" name="student-year" checked={year === y} onChange={() => onYearChange(y)} />
                {y}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}