import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { create, getAll, getWhere, put, remove } from '../services/store'
import { useToast } from '../components/Shared'
import MarkPresence from '../components/student/MarkPresence'
import AutoTimetable from '../components/student/AutoTimetable'

import {
  SCHEDULE_DATA,
  getProgramCourses,
  parseCourseKey,
} from '../data/scheduleData'

import type {
  Announcement,
  AttendanceRecord,
  TimetableEntry,
  UserProfile,
} from '../types'

const MIN_ATTENDANCE = 67

type Tab =
  | 'overview'
  | 'timetable'
  | 'mark'
  | 'history'
  | 'class'
  | 'announcements'

function getProgram(user: UserProfile) {
  const value = user.enrolledCourseIds?.[0] ?? ''

  if (value.includes('::')) {
    return parseCourseKey(value).programName
  }

  return value
}

function percentage(present: number, total: number) {
  if (!total) return 0
  return Math.round((present / total) * 100)
}

function announcementCategory(
  value: string
): Announcement['category'] {
  if (
    value === 'Academic' ||
    value === 'Event' ||
    value === 'Exam' ||
    value === 'Holiday' ||
    value === 'Urgent'
  ) {
    return value
  }

  return 'Academic'
}

export default function CRDashboard() {
  const { user, setUser } = useAuth()
  const { push } = useToast()

  const [activeTab, setActiveTab] =
    useState<Tab>('overview')

  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([])

  const [classUsers, setClassUsers] = useState<
    UserProfile[]
  >([])

  const [timetable, setTimetable] = useState<
    TimetableEntry[]
  >([])

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([])

  const [loading, setLoading] = useState(true)

  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null)

  const [announcementTitle, setAnnouncementTitle] =
    useState('')

  const [announcementMessage, setAnnouncementMessage] =
    useState('')

  const [announcementCategory, setAnnouncementCategory] =
    useState<Announcement['category']>('Academic')

  const [announcementUrgent, setAnnouncementUrgent] =
    useState(false)

  const [savingAnnouncement, setSavingAnnouncement] =
    useState(false)

  const [historyCourse, setHistoryCourse] =
    useState('')

  const [historyStatus, setHistoryStatus] =
    useState('')

  const [historyFrom, setHistoryFrom] =
    useState('')

  const [historyTo, setHistoryTo] =
    useState('')

  const [openPhoto, setOpenPhoto] =
    useState<string | null>(null)

  const programName = user ? getProgram(user) : ''
  const year = user?.year ?? ''

  const filteredHistory = attendance.filter((record) => {
    if (historyCourse && record.courseId !== historyCourse) {
      return false
    }

    if (historyStatus && record.status !== historyStatus) {
      return false
    }

    if (historyFrom && record.date < historyFrom) {
      return false
    }

    if (historyTo && record.date > historyTo) {
      return false
    }

    return true
  })

  const courses = useMemo(() => {
    if (!programName || !year) return []

    if (!SCHEDULE_DATA[programName]) return []

    return getProgramCourses(programName, year)
  }, [programName, year])

  async function refresh() {
    if (!user) return

    setLoading(true)

    try {
      const [
        ownAttendance,
        allUsers,
        ownTimetable,
        allAnnouncements,
      ] = await Promise.all([
        getWhere<AttendanceRecord>(
          'attendanceRecords',
          'studentId',
          user.uid
        ),

        getAll<UserProfile>('users'),

        getWhere<TimetableEntry>(
          'timetableEntries',
          'studentId',
          user.uid
        ),

        getAll<Announcement>('announcements'),
      ])

      setAttendance(
        ownAttendance.sort(
          (a, b) => b.createdAt - a.createdAt
        )
      )

      const classmates = allUsers
        .filter((candidate) => {
          if (
            candidate.role !== 'student' &&
            candidate.role !== 'cr'
          ) {
            return false
          }

          return (
            getProgram(candidate) === programName &&
            candidate.year === year
          )
        })
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        )

      const recordsByStudent = await Promise.all(
        classmates.map((student) =>
          getWhere<AttendanceRecord>(
            'attendanceRecords',
            'studentId',
            student.uid
          )
        )
      )

      setClassUsers(classmates)

      setTimetable(
        ownTimetable.sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        )
      )

      setAnnouncements(
        allAnnouncements
          .filter((item) => item.isActive !== false)
          .sort((a, b) => b.createdAt - a.createdAt)
      )

      setClassAttendanceRecords(
        recordsByStudent.flat()
      )
    } catch (error) {
      console.error(error)
      push(
        'Could not load your CR dashboard.',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  const [
    classAttendanceRecords,
    setClassAttendanceRecords,
  ] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    void refresh()
  }, [user?.uid, programName, year])

  const ownStats = useMemo(() => {
    const present = attendance.filter(
      (record) => record.status === 'present'
    ).length

    const total = attendance.length

    return {
      present,
      total,
      percentage: percentage(present, total),
    }
  }, [attendance])

  const classStats = useMemo(() => {
    let present = 0
    let total = 0

    for (const student of classUsers) {
      const records =
        classAttendanceRecords.filter(
          (record) =>
            record.studentId === student.uid
        )

      total += records.length

      present += records.filter(
        (record) => record.status === 'present'
      ).length
    }

    return {
      present,
      total,
      percentage: percentage(present, total),
    }
  }, [classUsers, classAttendanceRecords])

  function openCreateAnnouncement() {
    setEditingAnnouncement(null)
    setAnnouncementTitle('')
    setAnnouncementMessage('')
    setAnnouncementCategory('Academic')
    setAnnouncementUrgent(false)
  }

  function openEditAnnouncement(
    announcement: Announcement
  ) {
    setEditingAnnouncement(announcement)
    setAnnouncementTitle(announcement.title)
    setAnnouncementMessage(announcement.message)
    setAnnouncementCategory(
      announcement.category
    )
    setAnnouncementUrgent(announcement.isUrgent)
  }

  async function saveAnnouncement() {
    if (!user) return

    const title = announcementTitle.trim()
    const message = announcementMessage.trim()

    if (!title || !message) {
      push(
        'Please enter an announcement title and message.',
        'error'
      )
      return
    }

    setSavingAnnouncement(true)

    try {
      if (editingAnnouncement) {
        const updated: Announcement = {
          ...editingAnnouncement,
          title,
          message,
          category: announcementCategory,
          isUrgent: announcementUrgent,
        }

        await put<Announcement & { id: string }>(
          'announcements',
          {
            ...updated,
            id: updated.id,
          }
        )

        setAnnouncements((current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
        )

        push(
          'Announcement updated.',
          'success'
        )
      } else {
        const announcement: Announcement = {
          id: `announcement_${user.uid}_${Date.now()}`,
          title,
          message,
          category: announcementCategory,
          isUrgent: announcementUrgent,
          authorId: user.uid,
          authorName: user.name,
          createdAt: Date.now(),
          isActive: true,
        }

        await create<Announcement>(
          'announcements',
          announcement
        )

        setAnnouncements((current) => [
          announcement,
          ...current,
        ])

        push(
          'Announcement published.',
          'success'
        )
      }

      openCreateAnnouncement()
    } catch (error) {
      console.error(error)

      push(
        'Could not save the announcement.',
        'error'
      )
    } finally {
      setSavingAnnouncement(false)
    }
  }

  async function deleteAnnouncement(
    announcement: Announcement
  ) {
    if (!user) return

    if (announcement.authorId !== user.uid) {
      push(
        'You can only delete announcements created by you.',
        'error'
      )
      return
    }

    const confirmed = window.confirm(
      'Delete this announcement?'
    )

    if (!confirmed) return

    try {
      await remove(
        'announcements',
        announcement.id
      )

      setAnnouncements((current) =>
        current.filter(
          (item) =>
            item.id !== announcement.id
        )
      )

      push(
        'Announcement deleted.',
        'success'
      )
    } catch (error) {
      console.error(error)

      push(
        'Could not delete the announcement.',
        'error'
      )
    }
  }

  if (!user) {
    return null
  }

  const tabs: {
    id: Tab
    label: string
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
    },
    {
      id: 'timetable',
      label: 'Timetable',
    },
    {
      id: 'mark',
      label: 'Mark My Presence',
    },
    {
      id: 'history',
      label: 'History',
    },
    {
      id: 'class',
      label: 'Class Attendance',
    },
    {
      id: 'announcements',
      label: 'Announcements',
    },
  ]

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">
            Class representative
          </p>

          <h1 className="page-title">
            CR Dashboard
          </h1>

          <p className="page-subtitle">
            {programName || 'Programme'}
            {year ? ` · ${year}` : ''}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-ink bg-butter px-5 py-4">
          <div className="text-sm font-semibold">
            Your attendance
          </div>

          <div className="text-3xl font-black">
            {ownStats.percentage}%
          </div>
        </div>
      </section>

      <div className="card mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id)
              }
              className={
                activeTab === tab.id
                  ? 'btn-primary'
                  : 'btn-outline'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p>Loading dashboard…</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <section className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="card card-tint tint-sky">
                  <p className="text-sm font-semibold">
                    My attendance
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {ownStats.percentage}%
                  </p>

                  <p className="text-sm mt-1">
                    {ownStats.present}/
                    {ownStats.total} present
                  </p>
                </div>

                <div className="card card-tint tint-sage">
                  <p className="text-sm font-semibold">
                    Class strength
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {classUsers.length}
                  </p>
                </div>

                <div className="card card-tint tint-pink">
                  <p className="text-sm font-semibold">
                    Class attendance
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {classStats.percentage}%
                  </p>
                </div>
              </div>

              <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
                <section className="card overflow-hidden">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <div>
                      <p className="eyebrow">Class overview</p>
                      <h2 className="text-2xl font-black mt-1">Student attendance</h2>
                      <p className="text-sm text-ink-muted mt-1">
                        View your classmates' attendance. CRs cannot edit these records.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setActiveTab('class')}
                    >
                      View full list
                    </button>
                  </div>

                  {classUsers.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-ink/20 p-6 text-center">
                      <p className="font-semibold">No classmates found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border-2 border-ink/10">
                      <table className="table min-w-[620px]">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Attendance</th>
                            <th>Status</th>
                            <th>CR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classUsers.map((student) => {
                            const studentRecords = classAttendanceRecords.filter(
                              (record) => record.studentId === student.uid
                            )
                            const present = studentRecords.filter(
                              (record) => record.status === 'present'
                            ).length
                            const total = studentRecords.length
                            const value = percentage(present, total)

                            return (
                              <tr key={student.uid}>
                                <td>
                                  <div className="font-bold">{student.name}</div>
                                  <div className="text-xs text-ink-muted mt-0.5">{student.email}</div>
                                </td>
                                <td>
                                  <div className="font-bold">{present}/{total}</div>
                                  <div className="text-xs text-ink-muted mt-0.5">{value}%</div>
                                </td>
                                <td>
                                  {total === 0 ? (
                                    <span className="badge">No records</span>
                                  ) : value < MIN_ATTENDANCE ? (
                                    <span className="badge badge-danger">Below {MIN_ATTENDANCE}%</span>
                                  ) : (
                                    <span className="badge badge-success">On track</span>
                                  )}
                                </td>
                                <td>
                                  {student.role === 'cr' ? (
                                    <span className="badge bg-butter">✓ CR</span>
                                  ) : (
                                    <span className="text-ink-muted">—</span>
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

                <section className="card">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <div>
                      <p className="eyebrow">Class communication</p>
                      <h2 className="text-2xl font-black mt-1">Announcements</h2>
                      <p className="text-sm text-ink-muted mt-1">Latest updates for your class.</p>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setActiveTab('announcements')}
                    >
                      + Add
                    </button>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-ink/20 p-6 text-center">
                      <p className="font-semibold">No announcements yet.</p>
                      <p className="text-sm text-ink-muted mt-1">Create the first class update.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.slice(0, 4).map((announcement) => (
                        <article
                          key={announcement.id}
                          className="rounded-2xl border-2 border-ink/10 bg-cream px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-black truncate">{announcement.title}</h3>
                              <p className="text-sm text-ink-muted mt-1 line-clamp-2">
                                {announcement.message}
                              </p>
                            </div>
                            <span className="badge shrink-0">
                              {announcement.isUrgent ? 'Urgent' : announcement.category}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {announcements.length > 4 && (
                    <button
                      type="button"
                      className="btn-outline mt-4 w-full"
                      onClick={() => setActiveTab('announcements')}
                    >
                      View all announcements
                    </button>
                  )}
                </section>
              </div>
            </section>
          )}

          {activeTab === 'timetable' && (
            <section className="card">
              <div className="flex justify-between gap-3 items-start mb-5">
                <div>
                  <p className="eyebrow">
                    Schedule
                  </p>

                  <h2 className="text-2xl font-black">
                    My timetable
                  </h2>
                </div>
              </div>

              <AutoTimetable
                programName={programName}
                savedYear={year}
                onYearChange={async (nextYear) => {
                  if (user) {
                    const updated = { ...user, year: nextYear }
                    await put('users', { ...updated, id: user.uid })
                    setUser(updated)
                  }
                }}
              />
            </section>
          )}

          {activeTab === 'mark' && (
            <section className="card">
              <div className="mb-5">
                <p className="eyebrow">
                  Self check-in
                </p>

                <h2 className="text-2xl font-black">
                  Mark my presence
                </h2>

                <p className="text-slate-600 mt-1">
                  You can only mark your own attendance.
                  You cannot mark another student's attendance.
                </p>
              </div>

              <MarkPresence
                courses={courses.map((course) => ({
                  id: course.id,
                  name: course.name,
                  code: course.id,
                  category: 'DSC_MAIN_6',
                  maxAttendanceMarks: 6,
                }))}
                onSaved={() => {
                  void refresh()
                }}
              />
            </section>
          )}

          {activeTab === 'history' && (
            <section className="card">
              <div className="mb-5">
                <p className="eyebrow">
                  Attendance
                </p>

                <h2 className="text-2xl font-black">
                  My attendance history
                </h2>
              </div>

              <div className="grid gap-2 sm:grid-cols-4 mb-5">
                <select
                  className="input"
                  value={historyCourse}
                  onChange={(event) =>
                    setHistoryCourse(event.target.value)
                  }
                >
                  <option value="">All subjects</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={historyStatus}
                  onChange={(event) =>
                    setHistoryStatus(event.target.value)
                  }
                >
                  <option value="">All statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>

                <input
                  type="date"
                  className="input"
                  value={historyFrom}
                  onChange={(event) =>
                    setHistoryFrom(event.target.value)
                  }
                />

                <input
                  type="date"
                  className="input"
                  value={historyTo}
                  onChange={(event) =>
                    setHistoryTo(event.target.value)
                  }
                />
              </div>

              {filteredHistory.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
                  No attendance records match these filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>Photo</th>
                        <th>Location</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredHistory.map((record) => (
                        <tr key={record.id}>
                          <td>
                            {record.date}
                          </td>

                          <td>
                            <div className="font-bold">
                              {record.courseName}
                            </div>
                          </td>

                          <td>
                            {record.status === 'present' ? (
                              <span className="badge badge-success">
                                Present
                              </span>
                            ) : (
                              <span className="badge badge-danger">
                                Absent
                              </span>
                            )}
                          </td>

                          <td>
                            {record.source ===
                            'student_self_checkin'
                              ? 'Self check-in'
                              : 'Teacher'}
                          </td>

                          <td>
                            {record.photoUrl ? (
                              <button
                                type="button"
                                className="font-semibold underline"
                                onClick={() =>
                                  setOpenPhoto(record.photoUrl!)
                                }
                              >
                                View photo
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="capitalize">
                            {record.locationStatus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {openPhoto && (
                <div
                  className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Attendance photo"
                  onClick={() => setOpenPhoto(null)}
                >
                  <img
                    src={openPhoto}
                    alt="My attendance check-in"
                    className="max-h-[85vh] max-w-3xl rounded-2xl border-2 border-cream-soft object-contain"
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              )}
            </section>
          )}

          {activeTab === 'class' && (
            <section className="card">
              <div className="flex flex-wrap justify-between gap-3 items-start mb-5">
                <div>
                  <p className="eyebrow">
                    View only
                  </p>

                  <h2 className="text-2xl font-black">
                    Class attendance
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    CRs cannot edit attendance.
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-ink bg-butter px-5 py-3">
                  <span className="text-sm">
                    Class average
                  </span>

                  <strong className="block text-2xl">
                    {classStats.percentage}%
                  </strong>
                </div>
              </div>

              {classUsers.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
                  No classmates found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Present</th>
                        <th>Total</th>
                        <th>Attendance</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {classUsers.map((student) => {
                        const records =
                          classAttendanceRecords.filter(
                            (record) =>
                              record.studentId ===
                              student.uid
                          )

                        const present =
                          records.filter(
                            (record) =>
                              record.status ===
                              'present'
                          ).length

                        const total =
                          records.length

                        const value =
                          percentage(
                            present,
                            total
                          )

                        return (
                          <tr key={student.uid}>
                            <td>
                              <div className="font-bold">
                                {student.name}
                              </div>

                              {student.role ===
                                'cr' && (
                                <div className="text-xs text-slate-500">
                                  CR
                                </div>
                              )}
                            </td>

                            <td>
                              {present}
                            </td>

                            <td>
                              {total}
                            </td>

                            <td>
                              <strong>
                                {value}%
                              </strong>
                            </td>

                            <td>
                              {total === 0 ? (
                                <span className="badge">
                                  No records
                                </span>
                              ) : value <
                                MIN_ATTENDANCE ? (
                                <span className="badge badge-danger">
                                  Below {MIN_ATTENDANCE}%
                                </span>
                              ) : (
                                <span className="badge badge-success">
                                  On track
                                </span>
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
          )}

          {activeTab === 'announcements' && (
            <section className="space-y-5">
              <div className="card">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <p className="eyebrow">
                      Communication
                    </p>

                    <h2 className="text-2xl font-black">
                      Class announcements
                    </h2>

                    <p className="text-sm text-slate-600 mt-1">
                      Create and manage announcements for your class.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={
                      editingAnnouncement
                        ? openCreateAnnouncement
                        : openCreateAnnouncement
                    }
                  >
                    New announcement
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="label">
                      Title
                    </label>

                    <input
                      className="input"
                      value={announcementTitle}
                      onChange={(event) =>
                        setAnnouncementTitle(
                          event.target.value
                        )
                      }
                      placeholder="e.g. Assignment submission"
                    />
                  </div>

                  <div>
                    <label className="label">
                      Category
                    </label>

                    <select
                      className="input"
                      value={announcementCategory}
                      onChange={(event) =>
                        setAnnouncementCategory(
                          event.target.value as Announcement['category']
                        )
                      }
                    >
                      <option value="Academic">
                        Academic
                      </option>

                      <option value="Event">
                        Event
                      </option>

                      <option value="Exam">
                        Exam
                      </option>

                      <option value="Holiday">
                        Holiday
                      </option>

                      <option value="Urgent">
                        Urgent
                      </option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="label">
                    Message
                  </label>

                  <textarea
                    className="input min-h-32"
                    value={announcementMessage}
                    onChange={(event) =>
                      setAnnouncementMessage(
                        event.target.value
                      )
                    }
                    placeholder="Write the announcement..."
                  />
                </div>

                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announcementUrgent}
                    onChange={(event) =>
                      setAnnouncementUrgent(
                        event.target.checked
                      )
                    }
                  />

                  <span className="font-semibold">
                    Mark as urgent
                  </span>
                </label>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      savingAnnouncement
                    }
                    onClick={() =>
                      void saveAnnouncement()
                    }
                  >
                    {savingAnnouncement
                      ? 'Saving…'
                      : editingAnnouncement
                        ? 'Update announcement'
                        : 'Publish announcement'}
                  </button>

                  {editingAnnouncement && (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={
                        openCreateAnnouncement
                      }
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {announcements.length === 0 ? (
                  <div className="card text-center">
                    <div className="text-3xl">
                      📢
                    </div>

                    <p className="font-bold mt-2">
                      No announcements yet.
                    </p>
                  </div>
                ) : (
                  announcements.map(
                    (announcement) => (
                      <article
                        key={announcement.id}
                        className="card"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="badge">
                                {
                                  announcement.category
                                }
                              </span>

                              {announcement.isUrgent && (
                                <span className="badge badge-danger">
                                  Urgent
                                </span>
                              )}
                            </div>

                            <h3 className="text-xl font-black mt-3">
                              {
                                announcement.title
                              }
                            </h3>
                          </div>

                          {announcement.authorId ===
                            user.uid && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-outline text-sm"
                                onClick={() =>
                                  openEditAnnouncement(
                                    announcement
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="btn-danger text-sm"
                                onClick={() =>
                                  void deleteAnnouncement(
                                    announcement
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-slate-700">
                          {
                            announcement.message
                          }
                        </p>

                        <p className="text-xs text-slate-500 mt-4">
                          Posted by{' '}
                          {
                            announcement.authorName
                          }
                        </p>
                      </article>
                    )
                  )
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}