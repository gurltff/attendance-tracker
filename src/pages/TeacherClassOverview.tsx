          <div className="text-4xl mb-3">📚</div>
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getAll, getWhere, put } from '../services/store'
import { isDemoMode, notifyLocalAuthChanged, syncLocalUserProfile } from '../services/authService'
import { useToast } from '../components/Shared'
import {
  SCHEDULE_DATA,
  makeCourseKey,
  parseCourseKey,
} from '../data/scheduleData'

import type {
  AttendanceRecord,
  UserProfile,
} from '../types'

const MIN_ATTENDANCE = 67

interface ClassGroup {
  key: string
  programName: string
  year: string
  subjects: string[]
}

function getStudentProgram(user: UserProfile): string {
  const first = user.enrolledCourseIds?.[0] ?? ''

  if (first.includes('::')) {
    return parseCourseKey(first).programName
  }

  return first
}

function sameClass(
  student: UserProfile,
  programName: string,
  year: string
) {
  return (
    student.role === 'student' ||
    student.role === 'cr'
  ) &&
    getStudentProgram(student) === programName &&
    student.year === year
}

function percent(present: number, total: number) {
  if (total === 0) return 0
  return Math.round((present / total) * 100)
}

export default function TeacherClassOverview() {
  const { user } = useAuth()
  const { push } = useToast()

  const [users, setUsers] = useState<UserProfile[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState<string | null>(null)

  async function refresh() {
    if (!user) return

    setLoading(true)

    try {
      const [allUsers, recordsByCourse] = await Promise.all([
        getAll<UserProfile>('users'),
        Promise.all(
          (user.assignedCourseIds ?? []).map((courseKey) =>
            getWhere<AttendanceRecord>(
              'attendanceRecords',
              'courseKey',
              courseKey
            )
          )
        ),
      ])

      const allRecords = recordsByCourse.flat()

      setUsers(allUsers)
      setRecords(allRecords)
    } catch (error) {
      console.error(error)
      push('Could not load class data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [user?.uid])

  const classes = useMemo<ClassGroup[]>(() => {
    if (!user) return []

    const grouped = new Map<string, ClassGroup>()

    for (const rawKey of user.assignedCourseIds ?? []) {
      const parsed = parseCourseKey(rawKey)

      if (
        !parsed.programName ||
        !parsed.year ||
        !parsed.course
      ) {
        continue
      }

      if (!SCHEDULE_DATA[parsed.programName]) {
        continue
      }

      const key = `${parsed.programName}::${parsed.year}`

      const existing = grouped.get(key)

      if (existing) {
        if (!existing.subjects.includes(parsed.course)) {
          existing.subjects.push(parsed.course)
        }
      } else {
        grouped.set(key, {
          key,
          programName: parsed.programName,
          year: parsed.year,
          subjects: [parsed.course],
        })
      }
    }

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        subjects: [...item.subjects].sort(),
      }))
      .sort((a, b) => {
        const programCompare = a.programName.localeCompare(
          b.programName
        )

        if (programCompare !== 0) return programCompare

        return a.year.localeCompare(b.year)
      })
  }, [user])

  useEffect(() => {
    if (!selectedClass && classes.length > 0) {
      setSelectedClass(classes[0].key)
      return
    }

    if (
      selectedClass &&
      !classes.some((item) => item.key === selectedClass)
    ) {
      setSelectedClass(classes[0]?.key ?? '')
    }
  }, [classes, selectedClass])

  const activeClass = classes.find(
    (item) => item.key === selectedClass
  )

  const students = useMemo(() => {
    if (!activeClass) return []

    return users
      .filter((student) =>
        sameClass(
          student,
          activeClass.programName,
          activeClass.year
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users, activeClass])

  const classRecords = useMemo(() => {
    if (!activeClass) return []

    const prefix =
      `${activeClass.programName}::${activeClass.year}::`

    return records.filter((record) => {
      if (record.courseKey) {
        return record.courseKey.startsWith(prefix)
      }

      return false
    })
  }, [records, activeClass])

  const classOverall = useMemo(() => {
    if (students.length === 0) {
      return {
        present: 0,
        total: 0,
        percentage: 0,
      }
    }

    let present = 0
    let total = 0

    for (const student of students) {
      const studentRecords = classRecords.filter(
        (record) => record.studentId === student.uid
      )

      total += studentRecords.length

      present += studentRecords.filter(
        (record) => record.status === 'present'
      ).length
    }

    return {
      present,
      total,
      percentage: percent(present, total),
    }
  }, [students, classRecords])

  const currentCR = students.find(
    (student) => student.role === 'cr'
  )

  async function makeCR(student: UserProfile) {
    if (!user || !activeClass) return

    if (currentCR?.uid === student.uid) {
      push(`${student.name} is already the CR.`, 'info')
      return
    }

    setBusyUid(student.uid)

    try {
      // Exactly one CR is allowed in a class. The selected student becomes
      // CR and the previous CR (if any) is demoted back to student.
      const nextUsers = users.map((item) => {
        if (item.uid === student.uid) {
          return {
            ...item,
            role: 'cr' as const,
            year: activeClass.year,
            enrolledCourseIds: item.enrolledCourseIds?.length
              ? item.enrolledCourseIds
              : [activeClass.programName],
            assignedCourseIds: [activeClass.programName],
          }
        }

        if (
          item.role === 'cr' &&
          sameClass(
            item,
            activeClass.programName,
            activeClass.year
          )
        ) {
          const demoted = {
            ...item,
            role: 'student' as const,
          }
          delete demoted.assignedCourseIds
          return demoted
        }

        return item
      })

      // Persist every student whose role changed. This supports repeated
      // switching: Aarav → Priya → Aarav → Rohan → Priya, etc.
      const changed = nextUsers.filter((item) => {
        const before = users.find(
          (candidate) => candidate.uid === item.uid
        )

        return (
          before?.role !== item.role ||
          JSON.stringify(before?.assignedCourseIds ?? []) !==
            JSON.stringify(item.assignedCourseIds ?? [])
        )
      })

      for (const item of changed) {
        await put<UserProfile & { id: string }>('users', {
          ...item,
          id: item.uid,
        })

        // Demo authentication keeps its own local account copy. Keep it
        // synchronized with the users collection so a fresh login gets the
        // newly assigned role.
        if (isDemoMode()) {
          syncLocalUserProfile(item)
        }
      }

      setUsers(nextUsers)

      if (isDemoMode()) {
        localStorage.setItem(
          'sat_demo_cr_uid',
          student.uid
        )
        notifyLocalAuthChanged()
      }

      push(`${student.name} is now the CR.`, 'success')
    } catch (error) {
      console.error(error)
      push(
        'Could not make this student the CR. Check Firestore rules.',
        'error'
      )
    } finally {
      setBusyUid(null)
    }
  }

  async function removeCR(student: UserProfile) {
    if (!activeClass) return

    setBusyUid(student.uid)

    try {
      const updated: UserProfile = {
        ...student,
        role: 'student',
      }

      delete updated.assignedCourseIds

      await put<UserProfile & { id: string }>('users', {
        ...updated,
        id: student.uid,
      })

      setUsers((current) =>
        current.map((item) =>
          item.uid === student.uid ? updated : item
        )
      )

      if (isDemoMode()) {
        syncLocalUserProfile(updated)
        localStorage.removeItem('sat_demo_cr_uid')
        notifyLocalAuthChanged()
      }

      push(`${student.name} is no longer the CR.`, 'success')
    } catch (error) {
      console.error(error)
      push(
        'Could not remove CR status.',
        'error'
      )
    } finally {
      setBusyUid(null)
    }
  }

  if (!user) {
    return null
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Teacher workspace</p>

          <h1 className="page-title">
            Manage classes
          </h1>

          <p className="page-subtitle">
            Review class attendance and manage your class representative.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/teacher"
            className="btn-outline"
          >
            Mark attendance
          </Link>

          <Link
            to="/teacher/classes"
            className="btn-primary"
          >
            Manage classes
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="card">
          <p>Loading your classes…</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="card">

          <h2 className="text-xl font-bold">
            No classes assigned
          </h2>

          <p className="mt-2 text-slate-600">
            Add the programme, year and subjects you teach from
            “Manage my subjects”.
          </p>

          <Link
            to="/teacher"
            className="btn-primary inline-block mt-5"
          >
            Manage my subjects
          </Link>
        </div>
      ) : (
        <>
          <section className="card mb-6">
            <div className="grid md:grid-cols-[1fr_auto] gap-5 items-end">
              <div>
                <label
                  htmlFor="teacher-class"
                  className="label"
                >
                  Select class
                </label>

                <select
                  id="teacher-class"
                  className="input"
                  value={selectedClass}
                  onChange={(event) =>
                    setSelectedClass(event.target.value)
                  }
                >
                  {classes.map((item) => (
                    <option
                      key={item.key}
                      value={item.key}
                    >
                      {item.programName} — {item.year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border-2 border-ink bg-butter px-5 py-4">
                <div className="text-sm">
                  Minimum attendance
                </div>

                <div className="text-2xl font-black">
                  {MIN_ATTENDANCE}%
                </div>
              </div>
            </div>
          </section>

          {activeClass && (
            <>
              <section className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="card card-tint tint-sky">
                  <p className="text-sm font-semibold">
                    Students
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {students.length}
                  </p>
                </div>

                <div className="card card-tint tint-sage">
                  <p className="text-sm font-semibold">
                    Overall attendance
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {classOverall.percentage}%
                  </p>
                </div>

                <div className="card card-tint tint-pink">
                  <p className="text-sm font-semibold">
                    Class representative
                  </p>

                  <p className="text-lg font-black mt-2">
                    {currentCR?.name ?? 'Not assigned'}
                  </p>
                </div>
              </section>

              <section className="card mb-6">
                <div className="flex flex-wrap justify-between gap-3 items-start">
                  <div>
                    <p className="eyebrow">
                      {activeClass.year}
                    </p>

                    <h2 className="text-2xl font-black">
                      {activeClass.programName}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    {activeClass.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="badge"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="flex justify-between items-center gap-3 mb-5">
                  <div>
                    <h2 className="text-xl font-black">
                      Class attendance
                    </h2>

                    <p className="text-sm text-slate-600 mt-1">
                      Students below {MIN_ATTENDANCE}% are highlighted.
                    </p>
                  </div>
                </div>

                {students.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
                    <p className="font-semibold">
                      No students found in this class.
                    </p>

                    <p className="text-sm text-slate-500 mt-1">
                      Students must have the same programme and year.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Attendance</th>
                          <th>Status</th>
                          <th>CR</th>
                        </tr>
                      </thead>

                      <tbody>
                        {students.map((student) => {
                          const studentRecords =
                            classRecords.filter(
                              (record) =>
                                record.studentId === student.uid
                            )

                          const present =
                            studentRecords.filter(
                              (record) =>
                                record.status === 'present'
                            ).length

                          const total =
                            studentRecords.length

                          const percentage =
                            percent(present, total)

                          const belowMinimum =
                            total > 0 &&
                            percentage < MIN_ATTENDANCE

                          return (
                            <tr key={student.uid}>
                              <td>
                                <div className="font-bold">
                                  {student.name}
                                </div>

                                <div className="text-xs text-slate-500">
                                  {student.email}
                                </div>
                              </td>

                              <td>
                                <div className="font-bold">
                                  {present}/{total}
                                </div>

                                <div className="text-sm">
                                  {percentage}%
                                </div>
                              </td>

                              <td>
                                {total === 0 ? (
                                  <span className="badge">
                                    No records
                                  </span>
                                ) : belowMinimum ? (
                                  <span className="badge badge-danger">
                                    Below {MIN_ATTENDANCE}%
                                  </span>
                                ) : (
                                  <span className="badge badge-success">
                                    On track
                                  </span>
                                )}
                              </td>

                              <td>
                                {student.role === 'cr' ? (
                                  <button
                                    type="button"
                                    className="btn-outline text-sm"
                                    disabled={
                                      busyUid === student.uid
                                    }
                                    onClick={() =>
                                      void removeCR(student)
                                    }
                                  >
                                    {busyUid === student.uid
                                      ? 'Updating…'
                                      : 'Remove CR'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-outline text-sm"
                                    disabled={busyUid === student.uid}
                                    onClick={() =>
                                      void makeCR(student)
                                    }
                                  >
                                    {busyUid === student.uid ? 'Updating…' : 'Make CR'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}