import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../context/AuthContext'

import {
  create,
  getAll,
  getWhere,
} from '../services/store'

import {
  useToast,
} from '../components/Shared'

import TeacherSubjectManager from '../components/TeacherSubjectManager'

import {
  makeCourseKey,
  parseCourseKey,
} from '../data/scheduleData'

import type {
  AttendanceRecord,
  AttendanceSession,
  UserProfile,
} from '../types'

const normalise = (
  value?: string | null,
) =>
  (value ?? '')
    .trim()
    .toLowerCase()

function studentProgram(
  student: UserProfile,
) {
  const raw =
    student.enrolledCourseIds?.[0] ??
    ''

  /*
   * Supports both:
   *
   * B.Sc. (Hons) Physics
   *
   * and legacy composite values.
   */
  if (raw.includes('::')) {
    return parseCourseKey(
      raw,
    ).programName
  }

  return raw
}

export default function TeacherDashboard() {
  const {
    user,
    setUser,
  } = useAuth()

  const {
    push,
  } = useToast()

  const [
    students,
    setStudents,
  ] = useState<UserProfile[]>([])

  const [
    records,
    setRecords,
  ] = useState<AttendanceRecord[]>([])

  const [
    sessions,
    setSessions,
  ] = useState<AttendanceSession[]>([])

  const [
    courseKey,
    setCourseKey,
  ] = useState('')

  const [
    date,
    setDate,
  ] = useState(
    new Date()
      .toISOString()
      .slice(0, 10),
  )

  const [
    marks,
    setMarks,
  ] = useState<
    Record<
      string,
      'present' | 'absent'
    >
  >({})

  const [
    editingSubjects,
    setEditingSubjects,
  ] = useState(false)

  const [
    openPhoto,
    setOpenPhoto,
  ] = useState<string | null>(null)

  const [
    photoLoadError,
    setPhotoLoadError,
  ] = useState(false)

  const assignedCourseIds =
    user?.assignedCourseIds ??
    []

  /*
   * -------------------------------------------------------
   * Group teacher subjects by programme + year
   * -------------------------------------------------------
   */

  const subjectGroups =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            programName: string
            year: string
            subjects: {
              key: string
              course: string
            }[]
          }
        >()

      for (
        const assignedKey of
          assignedCourseIds
      ) {
        const parsed =
          parseCourseKey(
            assignedKey,
          )

        if (
          !parsed.programName ||
          !parsed.year ||
          !parsed.course
        ) {
          continue
        }

        const groupKey =
          `${parsed.programName}::${parsed.year}`

        if (!map.has(groupKey)) {
          map.set(
            groupKey,
            {
              programName:
                parsed.programName,
              year:
                parsed.year,
              subjects: [],
            },
          )
        }

        map
          .get(groupKey)!
          .subjects
          .push({
            key: assignedKey,
            course:
              parsed.course,
          })
      }

      return Array.from(
        map.values(),
      )
    }, [
      assignedCourseIds,
    ])

  /*
   * Select first subject automatically.
   */
  useEffect(() => {
    if (
      assignedCourseIds.length === 0
    ) {
      setCourseKey('')
      return
    }

    if (
      !courseKey ||
      !assignedCourseIds.includes(
        courseKey,
      )
    ) {
      setCourseKey(
        assignedCourseIds[0],
      )
    }
  }, [
    assignedCourseIds,
    courseKey,
  ])

  /*
   * -------------------------------------------------------
   * Load students + attendance
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!user) return
    const teacherId = user.uid

    async function load() {
      try {
        const [
          allUsers,
          allSessions,
        ] =
          await Promise.all([
            getAll<UserProfile>(
              'users',
            ),
            getWhere<AttendanceSession>(
              'attendanceSessions',
              'teacherId',
              teacherId,
            ),
          ])

        setStudents(
          allUsers.filter(
            (item) =>
              item.role ===
                'student' ||
              item.role === 'cr',
          ),
        )

        setSessions(
          allSessions,
        )
      } catch (error) {
        console.error(error)

        push(
          'Could not load teacher data.',
          'error',
        )
      }
    }

    load()
  }, [
    user,
    push,
  ])

  /*
   * Load attendance for the selected subject.
   */
  useEffect(() => {
    if (!courseKey) {
      setRecords([])
      return
    }

    let cancelled = false

    const refreshRecords = () => {
      getWhere<AttendanceRecord>(
        'attendanceRecords',
        'courseKey',
        courseKey,
      )
        .then((nextRecords) => {
          if (!cancelled) setRecords(nextRecords)
        })
        .catch((error) => {
          if (cancelled) return
          console.error(error)
          setRecords([])
        })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshRecords()
      }
    }

    refreshRecords()

    const refreshTimer = window.setInterval(
      refreshRecords,
      15000,
    )

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [
    courseKey,
  ])

  const selected =
    courseKey
      ? parseCourseKey(
          courseKey,
        )
      : null

  /*
   * -------------------------------------------------------
   * ONLY students from the selected programme + year
   * -------------------------------------------------------
   */

  const classStudents =
    useMemo(() => {
      if (!selected) {
        return []
      }

      return students.filter(
        (student) =>
          normalise(
            studentProgram(
              student,
            ),
          ) ===
            normalise(
              selected.programName,
            ) &&
          normalise(
            student.year,
          ) ===
            normalise(
              selected.year,
            ),
      )
    }, [
      students,
      selected,
    ])

  const studentIds =
    useMemo(
      () =>
        new Set(
          classStudents.map(
            (student) =>
              student.uid,
          ),
        ),
      [
        classStudents,
      ],
    )

  const scopedRecords =
    useMemo(
      () =>
        records.filter(
          (record) =>
            studentIds.has(
              record.studentId,
            ),
        ),
      [
        records,
        studentIds,
      ],
    )

  const alreadyMarkedToday =
    useMemo(
      () =>
        new Set(
          scopedRecords
            .filter(
              (record) =>
                record.date ===
                  date &&
                record.source ===
                  'teacher_marked',
            )
            .map(
              (record) =>
                record.studentId,
            ),
        ),
      [
        scopedRecords,
        date,
      ],
    )

  /*
   * -------------------------------------------------------
   * Submit attendance
   * -------------------------------------------------------
   */

  async function submitAttendance(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    if (
      !user ||
      !selected ||
      !courseKey
    ) {
      return
    }

    const duplicateSession =
      sessions.some(
        (session) =>
          session.courseKey ===
            courseKey &&
          session.date ===
            date,
      )

    if (duplicateSession) {
      push(
        'Attendance for this subject and date was already submitted.',
        'error',
      )
      return
    }

    if (
      classStudents.length ===
      0
    ) {
      push(
        'There are no students in this class yet.',
        'error',
      )
      return
    }

    try {
      /*
       * Create one record for every student.
       */
      await Promise.all(
        classStudents.map(
          async (student) => {
            const status =
              marks[
                student.uid
              ] ??
              'absent'

            const record: AttendanceRecord =
              {
                id: '',
                studentId:
                  student.uid,
                studentName:
                  student.name,
                courseId:
                  selected.course,
                courseName:
                  selected.course,
                courseKey,
                teacherId:
                  user.uid,
                date,
                status,
                source:
                  'teacher_marked',
                locationStatus:
                  'unavailable',
                createdAt:
                  Date.now(),
              }

            await create(
              'attendanceRecords',
              record,
            )
          },
        ),
      )

      const session:
        AttendanceSession =
        {
          id: '',
          teacherId:
            user.uid,
          courseId:
            selected.course,
          courseName:
            selected.course,
          courseKey,
          date,
          createdAt:
            Date.now(),
        }

      await create(
        'attendanceSessions',
        session,
      )

      setSessions(
        (previous) => [
          ...previous,
          session,
        ],
      )

      setMarks({})

      push(
        'Attendance submitted successfully.',
        'success',
      )

      const refreshed =
        await getWhere<AttendanceRecord>(
          'attendanceRecords',
          'courseKey',
          courseKey,
        )

      setRecords(
        refreshed,
      )
    } catch (error) {
      console.error(error)

      push(
        'Could not submit attendance. Please try again.',
        'error',
      )
    }
  }

  return (
    <main className="page-shell space-y-6">

      {/* HEADER */}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Teacher dashboard
          </h1>

          <p className="text-ink/70 mt-1">
            Mark attendance, manage your classes and
            review student self check-ins.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            className="btn-outline text-sm bg-ink text-cream-soft"
            to="/teacher"
          >
            📝 Mark attendance
          </Link>

          <Link
            className="btn-outline text-sm"
            to="/teacher/classes"
          >
            📊 Manage classes
          </Link>

          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() =>
              setEditingSubjects(true)
            }
          >
            ✏️ Manage my subjects
          </button>
        </div>
      </div>

      {/* SUBJECT SUMMARY */}

      <div className="card-tint tint-sky">
        <h2 className="font-extrabold text-lg mb-3">
          My subjects
        </h2>

        {subjectGroups.length ===
        0 ? (
          <div className="text-sm text-ink/70">
            You haven't selected any subjects yet.
            Use "Manage my subjects" to choose the
            programme, year and subjects you teach.
          </div>
        ) : (
          <div className="space-y-4">
            {subjectGroups.map(
              (group) => (
                <div
                  key={`${group.programName}::${group.year}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/50 mb-2">
                    {group.programName} ·{' '}
                    {group.year}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {group.subjects.map(
                      (subject) => (
                        <span
                          key={
                            subject.key
                          }
                          className="px-3 py-1.5 rounded-full bg-butter border-2 border-ink text-xs font-semibold"
                        >
                          {subject.course}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {assignedCourseIds.length >
        0 && (
        <>
          {/* ATTENDANCE */}

          <div className="card-tint tint-sky">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-extrabold text-lg">
                  Mark attendance
                </h2>

                <p className="text-sm text-ink/60 mt-1">
                  Only students from the selected
                  programme and year are shown.
                </p>
              </div>
            </div>

            <form
              onSubmit={
                submitAttendance
              }
              className="space-y-4"
            >
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[280px] flex-1">
                  <label className="text-sm font-semibold">
                    Class / subject
                  </label>

                  <select
                    className="input mt-1"
                    value={courseKey}
                    onChange={(
                      event,
                    ) => {
                      setCourseKey(
                        event.target.value,
                      )
                      setMarks({})
                    }}
                  >
                    {subjectGroups.map(
                      (group) => (
                        <optgroup
                          key={`${group.programName}::${group.year}`}
                          label={`${group.programName} · ${group.year}`}
                        >
                          {group.subjects.map(
                            (
                              subject,
                            ) => (
                              <option
                                key={
                                  subject.key
                                }
                                value={
                                  subject.key
                                }
                              >
                                {
                                  subject.course
                                }
                              </option>
                            ),
                          )}
                        </optgroup>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold">
                    Date
                  </label>

                  <input
                    type="date"
                    className="input mt-1"
                    value={date}
                    onChange={(
                      event,
                    ) =>
                      setDate(
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              {selected && (
                <div className="px-4 py-3 rounded-2xl bg-cream-soft/70 border-2 border-ink/20">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/50">
                    Selected class
                  </p>

                  <p className="font-bold mt-1">
                    {
                      selected.programName
                    }{' '}
                    ·{' '}
                    {
                      selected.year
                    }
                  </p>

                  <p className="text-sm text-ink/60">
                    Subject: {
                      selected.course
                    }
                  </p>
                </div>
              )}

              <div className="divide-y divide-ink/15 bg-cream-soft/60 rounded-2xl border-2 border-ink/20 px-3">
                {classStudents.map(
                  (student) => {
                    const already =
                      alreadyMarkedToday.has(
                        student.uid,
                      )

                    return (
                      <div
                        key={
                          student.uid
                        }
                        className="flex items-center justify-between py-3 gap-3"
                      >
                        <div>
                          <span className="text-sm font-semibold">
                            {
                              student.name
                            }
                          </span>

                          {student.role ===
                            'cr' && (
                            <span className="ml-2 badge bg-butter">
                              CR
                            </span>
                          )}

                          {already && (
                            <p className="text-xs text-ink/50 mt-0.5">
                              Already recorded
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={
                              already
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-ink ${
                              marks[
                                student.uid
                              ] ===
                              'present'
                                ? 'bg-sage'
                                : ''
                            }`}
                            onClick={() =>
                              setMarks(
                                (
                                  previous,
                                ) => ({
                                  ...previous,
                                  [student.uid]:
                                    'present',
                                }),
                              )
                            }
                          >
                            Present
                          </button>

                          <button
                            type="button"
                            disabled={
                              already
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-ink ${
                              marks[
                                student.uid
                              ] ===
                              'absent'
                                ? 'bg-blush'
                                : ''
                            }`}
                            onClick={() =>
                              setMarks(
                                (
                                  previous,
                                ) => ({
                                  ...previous,
                                  [student.uid]:
                                    'absent',
                                }),
                              )
                            }
                          >
                            Absent
                          </button>
                        </div>
                      </div>
                    )
                  },
                )}

                {classStudents.length ===
                  0 && (
                  <p className="text-sm text-ink/60 py-5">
                    No students are registered
                    in this programme and year.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  classStudents.length ===
                  0
                }
              >
                Submit attendance
              </button>
            </form>
          </div>

          {/* SELF CHECK-IN */}

          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-extrabold text-lg">
                  Student self check-ins
                </h2>

                <p className="text-sm text-ink/60">
                  Photo and location check-ins from
                  this class and subject.
                </p>
              </div>

              <span className="badge bg-butter">
                {
                  scopedRecords.filter(
                    (record) =>
                      record.source ===
                      'student_self_checkin',
                  ).length
                }{' '}
                check-ins
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink/60 border-b-2 border-ink/20">
                    <th className="py-2 pr-3">
                      Student
                    </th>
                    <th className="pr-3">
                      Date
                    </th>
                    <th className="pr-3">
                      Photo
                    </th>
                    <th className="pr-3">
                      Location
                    </th>
                    <th>
                      Map
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {scopedRecords
                    .filter(
                      (record) =>
                        record.source ===
                        'student_self_checkin',
                    )
                    .map(
                      (record) => (
                        <tr
                          key={
                            record.id
                          }
                          className="border-b border-ink/10"
                        >
                          <td className="py-3 pr-3">
                            {
                              record.studentName
                            }
                          </td>

                          <td className="pr-3">
                            {
                              record.date
                            }
                          </td>

                          <td className="pr-3">
                            {record.photoUrl ? (
                              <button
                                type="button"
                                className="font-semibold underline"
                                onClick={() => {
                                  setPhotoLoadError(false)
                                  setOpenPhoto(
                                    record.photoUrl!,
                                  )
                                }}
                              >
                                View photo
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="pr-3 capitalize">
                            {
                              record.locationStatus
                            }
                          </td>

                          <td>
                            {record.geoTag ? (
                              <a
                                href={`https://www.google.com/maps?q=${record.geoTag.latitude},${record.geoTag.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold underline"
                              >
                                View
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ),
                    )}

                  {!scopedRecords.some(
                    (record) =>
                      record.source ===
                      'student_self_checkin',
                  ) && (
                    <tr>
                      <td
                        colSpan={
                          5
                        }
                        className="py-6 text-ink/50"
                      >
                        No self check-ins for
                        this subject yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingSubjects &&
        user && (
          <TeacherSubjectManager
            user={user}
            setUser={setUser}
            onClose={() =>
              setEditingSubjects(
                false,
              )
            }
          />
        )}

      {openPhoto && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Attendance photo"
          onClick={() => setOpenPhoto(null)}
        >
          <div className="relative max-h-full max-w-3xl">
            {photoLoadError ? (
              <p className="rounded-2xl bg-cream-soft px-6 py-5 font-semibold text-ink">
                This attendance photo could not be displayed.
              </p>
            ) : (
              <img
                src={openPhoto}
                alt="Student attendance check-in"
                className="max-h-[85vh] max-w-full rounded-2xl border-2 border-cream-soft object-contain"
                onError={() => setPhotoLoadError(true)}
                onClick={(event) => event.stopPropagation()}
              />
            )}

            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-ink px-3 py-1 text-lg font-bold text-cream-soft"
              aria-label="Close photo"
              onClick={() => setOpenPhoto(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  )
}