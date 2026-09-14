import { useState } from 'react'
import type { AttendanceRecord, Course } from '../../types'

export default function History({ records, courses }: { records: AttendanceRecord[]; courses: Course[] }) {
  const [courseFilter, setCourseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [openPhoto, setOpenPhoto] = useState<string | null>(null)
  const [photoLoadError, setPhotoLoadError] = useState(false)

  const filtered = records.filter((r) => {
    if (courseFilter && r.courseId !== courseFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    if (from && r.date < from) return false
    if (to && r.date > to) return false
    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <div className="card grid sm:grid-cols-4 gap-2">
        <select className="input" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
        </select>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/60 border-b-2 border-ink/20">
              <th className="py-2 pr-2 font-semibold">Date</th><th className="pr-2 font-semibold">Course</th><th className="pr-2 font-semibold">Status</th>
              <th className="pr-2 font-semibold">Source</th><th className="pr-2 font-semibold">Photo</th><th className="font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-ink/10 last:border-0">
                <td className="py-2 pr-2">{r.date}</td>
                <td className="pr-2">{r.courseName}</td>
                <td className="pr-2">
                  <span className={`badge ${r.status === 'present' ? 'bg-sage' : 'bg-blush'} text-ink`}>{r.status}</span>
                </td>
                <td className="pr-2">{r.source === 'student_self_checkin' ? 'Self check-in' : 'Teacher marked'}</td>
                <td className="pr-2">
                  {r.photoUrl ? (
                    <button className="font-semibold underline decoration-2 underline-offset-2" onClick={() => { setPhotoLoadError(false); setOpenPhoto(r.photoUrl!) }}>View</button>
                  ) : '—'}
                </td>
                <td className="capitalize">{r.locationStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-ink-muted py-6 text-center">No records found.</p>}
      </div>

      {openPhoto && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center p-4 z-40" onClick={() => setOpenPhoto(null)}>
          {photoLoadError ? (
            <p className="rounded-2xl bg-cream-soft px-6 py-5 font-semibold text-ink">
              This attendance photo could not be displayed.
            </p>
          ) : (
            <img src={openPhoto} alt="Attendance check-in" className="max-h-[85vh] max-w-md rounded-2xl border-2 border-cream-soft object-contain" onError={() => setPhotoLoadError(true)} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  )
}