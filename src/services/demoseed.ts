import { ensureDemoAccount } from './authService'
import { put, getAll } from './store'
import { getProgramCourses, makeCourseKey, ABBREV_LEGEND } from '../data/scheduleData'
import type { UserProfile, AttendanceRecord, AttendanceSession, Announcement, TimetableEntry } from '../types'

export const DEMO_PASSWORD = 'Demo@1234'

export const DEMO_STUDENT_SEEDS = [
  { name: 'Aarav Sharma', email: 'aarav.demo@example.com' },
  { name: 'Priya Nair', email: 'priya.demo@example.com' },
  { name: 'Rohan Verma', email: 'rohan.demo@example.com' },
]

export const DEMO_TEACHER_SEEDS = [
  { name: 'Dr. Mehta', email: 'mehta.demo@example.com' },
  { name: 'Ms. Kapoor', email: 'kapoor.demo@example.com' },
]

export const DEMO_LOGINS = [
  ...DEMO_STUDENT_SEEDS.map((x) => ({ ...x, role: 'student' as const })),
  ...DEMO_TEACHER_SEEDS.map((x) => ({ ...x, role: 'teacher' as const })),
]

export const DEMO_PROGRAM = 'B.Sc. (Hons) Physics'
export const DEMO_YEAR = 'Second Year'

function dateStr(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function label(course: string) {
  return ABBREV_LEGEND[course] ?? course
}

function clearDemoCollections() {
  const collections = [
    'users',
    'attendanceRecords',
    'attendanceSessions',
    'timetableEntries',
    'announcements',
    'courses',
  ]
  for (const col of collections) localStorage.removeItem(`sat_${col}`)
  localStorage.removeItem('sat_local_users')
  localStorage.removeItem('sat_local_auth_uid')
}

export function hasDemoData() {
  try {
    const raw = localStorage.getItem('sat_local_users')
    if (!raw) return false
    const users = Object.values(JSON.parse(raw) as Record<string, UserProfile & { password: string }>)
    return DEMO_LOGINS.every((login) => users.some((u) => u.email === login.email))
  } catch {
    return false
  }
}

export async function setupDemoData(onProgress?: (message: string) => void) {
  localStorage.setItem('sat_demo_mode', '1')
  localStorage.removeItem('sat_local_auth_uid')
  localStorage.removeItem('sat_demo_cr_uid')
  clearDemoCollections()

  const progress = (message: string) => onProgress?.(message)
  const courses = getProgramCourses(DEMO_PROGRAM, DEMO_YEAR)
  if (!courses.length) throw new Error(`No timetable data found for ${DEMO_PROGRAM} · ${DEMO_YEAR}.`)

  const preferred = ['DE', 'MP-III', 'L & M']
  const selectedSubjects = preferred.filter((name) => courses.some((c) => c.name === name))
  const demoSubjects = selectedSubjects.length >= 3 ? selectedSubjects : courses.slice(0, 3).map((c) => c.name)

  const mehtaKeys = demoSubjects.slice(0, 2).map((c) => makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, c))
  const kapoorKeys = demoSubjects.slice(2).map((c) => makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, c))

  progress('Creating demo teachers…')
  const mehta = await ensureDemoAccount('Dr. Mehta', 'mehta.demo@example.com', DEMO_PASSWORD, 'teacher', { assignedCourseIds: mehtaKeys, year: DEMO_YEAR })
  const kapoor = await ensureDemoAccount('Ms. Kapoor', 'kapoor.demo@example.com', DEMO_PASSWORD, 'teacher', { assignedCourseIds: kapoorKeys, year: DEMO_YEAR })

  progress('Creating demo students…')
  const students: UserProfile[] = []
  for (const seed of DEMO_STUDENT_SEEDS) {
    const student = await ensureDemoAccount(seed.name, seed.email, DEMO_PASSWORD, 'student', {
      enrolledCourseIds: [DEMO_PROGRAM],
      year: DEMO_YEAR,
    })
    const clean = { ...student, role: 'student' as const, enrolledCourseIds: [DEMO_PROGRAM], year: DEMO_YEAR }
    await put('users', { ...clean, id: clean.uid })
    students.push(clean)
  }

  // Initial CR is Aarav. Only teachers can change this later.
  progress('Assigning Aarav as the initial CR…')
  const aarav = students[0]
  const aaravCR: UserProfile = { ...aarav, role: 'cr', assignedCourseIds: [DEMO_PROGRAM] }
  await put('users', { ...aaravCR, id: aaravCR.uid })
  localStorage.setItem('sat_demo_cr_uid', aaravCR.uid)

  // Teacher profiles are stored after students so their subject assignments are always fresh.
  await put('users', { ...mehta, role: 'teacher', assignedCourseIds: mehtaKeys, year: DEMO_YEAR, id: mehta.uid })
  await put('users', { ...kapoor, role: 'teacher', assignedCourseIds: kapoorKeys, year: DEMO_YEAR, id: kapoor.uid })

  progress('Creating attendance history…')
  const teacherByCourse: Record<string, string> = {}
  for (const key of mehtaKeys) teacherByCourse[key.split('::')[2]] = mehta.uid
  for (const key of kapoorKeys) teacherByCourse[key.split('::')[2]] = kapoor.uid

  let counter = 0
  for (let daysAgo = 12; daysAgo >= 1; daysAgo--) {
    const date = dateStr(daysAgo)
    for (const courseName of demoSubjects) {
      const teacherId = teacherByCourse[courseName] ?? mehta.uid
      const courseKey = makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, courseName)
      for (const student of students) {
        let present = true
        if (student.email === 'rohan.demo@example.com') present = daysAgo % 3 !== 0
        if (student.email === 'aarav.demo@example.com') present = daysAgo % 4 !== 0
        const record: AttendanceRecord = {
          id: `demo_att_${counter++}`,
          studentId: student.uid,
          studentName: student.name,
          courseId: courseName,
          courseName: label(courseName),
          courseKey,
          teacherId,
          date,
          status: present ? 'present' : 'absent',
          source: 'teacher_marked',
          locationStatus: 'unavailable',
          createdAt: new Date(`${date}T10:00:00`).getTime(),
        }
        await put('attendanceRecords', record)
      }
      const session: AttendanceSession = {
        id: `demo_session_${date}_${courseName.replace(/[^a-zA-Z0-9]/g, '_')}`,
        teacherId,
        courseId: courseName,
        courseName: label(courseName),
        courseKey,
        date,
        createdAt: new Date(`${date}T09:00:00`).getTime(),
      }
      await put('attendanceSessions', session)
    }
  }

  progress('Creating timetable data…')
  for (const student of students) {
    for (const course of courses.slice(0, 8)) {
      const entry: TimetableEntry = {
        id: `demo_tt_${student.uid}_${course.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        studentId: student.uid,
        day: 'Mon',
        startTime: '10:30',
        endTime: '11:30',
        courseId: course.name,
        courseName: course.name,
        category: 'GE_5',
      }
      await put('timetableEntries', entry)
    }
  }

  progress('Creating class announcement…')
  const announcement: Announcement = {
    id: 'demo_announcement_1',
    title: 'Demo class update',
    message: 'Tomorrow’s class will follow the regular timetable. Please keep your attendance above the 67% requirement.',
    category: 'Academic',
    isUrgent: false,
    authorId: aaravCR.uid,
    authorName: aaravCR.name,
    createdAt: Date.now(),
    isActive: true,
  }
  await put('announcements', announcement)

  progress('Demo setup complete.')
}
