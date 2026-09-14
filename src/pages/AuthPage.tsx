import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  logIn,
  logInDemo,
  resendVerificationEmail,
  resetPassword,
  signUp,
} from '../services/authService'
import Captcha, { type CaptchaHandle } from '../components/Captcha'
import {
  getAll,
  seedIfEmpty,
} from '../services/store'
import { mockAnnouncements } from '../services/mockData'
import type {
  Announcement,
  Role,
} from '../types'
import {
  AnnouncementList,
  isAnnouncementLive,
} from '../components/Announcements'
import { useToast } from '../components/Shared'
import {
  setupDemoData,
  hasDemoData,
  DEMO_PASSWORD,
  DEMO_LOGINS,
} from '../services/demoseed'
import TeacherSubjectPicker from '../components/TeacherSubjectPicker'
import StudentProgramPicker from '../components/StudentProgramPicker'

function routeForRole(role: Role) {
  if (role === 'teacher') return '/teacher'
  if (role === 'cr') return '/cr'
  return '/student'
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { user, loading, setUser } = useAuth()
  const { push } = useToast()

  const [mode, setMode] =
    useState<'login' | 'signup'>('login')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] =
    useState('')

  const [role, setRole] =
    useState<'student' | 'teacher'>(
      'student'
    )

  const [studentProgram, setStudentProgram] =
    useState('')

  const [studentYear, setStudentYear] =
    useState('')

  const [
    teacherSubjects,
    setTeacherSubjects,
  ] = useState<string[]>([])

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([])

  const [showAll, setShowAll] =
    useState(false)

  const [busy, setBusy] =
    useState(false)

  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false)

  const [
    resetMessage,
    setResetMessage,
  ] = useState('')

  const [demoReady, setDemoReady] =
    useState(false)

  const [demoStatus, setDemoStatus] =
    useState('')

  const [verificationSent, setVerificationSent] =
    useState(false)

  const [captchaInput, setCaptchaInput] =
    useState('')

  const captchaRef =
    useRef<CaptchaHandle>(null)

  /*
   * Automatically redirect authenticated users
   * to the correct dashboard.
   */
  useEffect(() => {
    if (loading || !user) return

    navigate(
      routeForRole(user.role),
      {
        replace: true,
      }
    )
  }, [
    user,
    loading,
    navigate,
  ])

  /*
   * Load announcements and demo state.
   */
  useEffect(() => {
    seedIfEmpty(
      'announcements',
      mockAnnouncements
    )

    getAll<Announcement>(
      'announcements'
    )
      .then((all) => {
        const source =
          all.length > 0
            ? all
            : mockAnnouncements

        setAnnouncements(
          source
            .filter(isAnnouncementLive)
            .sort(
              (a, b) =>
                b.createdAt -
                a.createdAt
            )
        )
      })
      .catch((error) => {
        console.error(error)
        setAnnouncements(
          mockAnnouncements.filter(isAnnouncementLive)
        )
      })

    setDemoReady(hasDemoData())
  }, [])

  function switchMode(
    next: 'login' | 'signup'
  ) {
    setMode(next)
    setResetMessage('')
    setVerificationSent(false)

    if (next === 'login') {
      setName('')
      setStudentProgram('')
      setStudentYear('')
      setTeacherSubjects([])
    }

    setCaptchaInput('')
    captchaRef.current?.refresh()
  }

  /*
   * FORGOT PASSWORD
   */
  async function handleForgotPassword() {
    setResetMessage('')

    if (!email.trim()) {
      setResetMessage(
        'Please enter your email address first.'
      )
      return
    }

    if (mode !== 'login') {
      setResetMessage(
        'Switch to Log in to reset your password.'
      )
      return
    }

    setResettingPassword(true)

    try {
      await resetPassword(email)

      setResetMessage(
        'Password reset email sent. Check your inbox.'
      )

      push(
        'Password reset email sent!',
        'success'
      )
    } catch (error: any) {
      console.error(error)

      const code = error?.code

      if (code === 'auth/user-not-found') {
        setResetMessage(
          'No Firebase account was found with this email.'
        )
      } else if (
        code === 'auth/invalid-email'
      ) {
        setResetMessage(
          'Please enter a valid email address.'
        )
      } else if (
        code === 'auth/too-many-requests'
      ) {
        setResetMessage(
          'Too many attempts. Please wait and try again later.'
        )
      } else if (
        error?.message
      ) {
        setResetMessage(
          error.message
        )
      } else {
        setResetMessage(
          'Unable to send the reset email. Please try again.'
        )
      }
    } finally {
      setResettingPassword(false)
    }
  }

  /*
   * DEMO SETUP
   */
  async function handleSetupDemo() {
    setBusy(true)

    try {
      await setupDemoData(
        setDemoStatus
      )

      localStorage.setItem(
        'demo_data_ready',
        '1'
      )

      setDemoReady(true)

      push(
        'Demo data ready!',
        'success'
      )
    } catch (error: any) {
      console.error(error)

      push(
        error?.message ??
          'Demo setup failed.',
        'error'
      )
    } finally {
      setBusy(false)
      setDemoStatus('')
    }
  }

  /*
   * DEMO LOGIN
   */
  async function handleDemoLogin(
    demoEmail: string
  ) {
    setBusy(true)

    try {
      const profile =
        await logInDemo(
          demoEmail,
          DEMO_PASSWORD
        )

      if (!profile) {
        throw new Error(
          'Demo account was not found. Run Set up demo data first.'
        )
      }

      setUser(profile)

      push(
        `Demo login: ${profile.name}`,
        'success'
      )

      navigate(
        routeForRole(profile.role),
        {
          replace: true,
        }
      )
    } catch (error: any) {
      console.error(error)

      push(
        error?.message ??
          'Demo login failed.',
        'error'
      )
    } finally {
      setBusy(false)
    }
  }

  /*
   * LOGIN / SIGNUP
   */
  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault()

    if (busy) return

    setResetMessage('')
    setVerificationSent(false)

    if (!captchaRef.current?.verify(captchaInput)) {
      push(
        'Security check failed — please retype the code shown.',
        'error'
      )
      captchaRef.current?.refresh()
      setCaptchaInput('')
      return
    }

    setBusy(true)

    try {
      if (mode === 'signup') {
        if (role === 'student') {
          if (
            !studentProgram ||
            !studentYear
          ) {
            throw new Error(
              'Please select your programme and current year.'
            )
          }

          const profile =
            await signUp(
              name.trim(),
              email.trim(),
              password,
              'student',
              {
                enrolledCourseIds: [
                  studentProgram,
                ],
                year: studentYear,
              }
            )

          setUser(profile)

          push(
            'Account created — welcome!',
            'success'
          )

          navigate(
            routeForRole(
              profile.role
            ),
            {
              replace: true,
            }
          )

          return
        }

        if (
          role === 'teacher' &&
          teacherSubjects.length === 0
        ) {
          throw new Error(
            'Please select at least one subject you teach.'
          )
        }

        const profile =
          await signUp(
            name.trim(),
            email.trim(),
            password,
            'teacher',
            {
              assignedCourseIds:
                teacherSubjects,
            }
          )

        setUser(profile)

        push(
          'Teacher account created — welcome!',
          'success'
        )

        navigate(
          routeForRole(
            profile.role
          ),
          {
            replace: true,
          }
        )

        return
      }

      const profile =
        await logIn(
          email.trim(),
          password
        )

      if (!profile) {
        throw new Error(
          'Invalid email or password.'
        )
      }

      setUser(profile)

      push(
        `Welcome back, ${profile.name}!`,
        'success'
      )

      navigate(
        routeForRole(
          profile.role
        ),
        {
          replace: true,
        }
      )
    } catch (error: any) {
      console.error(error)

      let message =
        error?.message ??
        'Something went wrong.'

      /*
       * Friendlier Firebase login errors.
       */
      if (
        error?.code ===
        'auth/invalid-credential'
      ) {
        message =
          'Incorrect email or password.'
      } else if (
        error?.code ===
        'auth/user-not-found'
      ) {
        message =
          'No account was found with this email.'
      } else if (
        error?.code ===
        'auth/wrong-password'
      ) {
        message =
          'Incorrect password.'
      } else if (
        error?.code ===
        'auth/invalid-email'
      ) {
        message =
          'Please enter a valid email address.'
      } else if (
        error?.code ===
        'auth/email-already-in-use'
      ) {
        message =
          'This email already has an account. Please log in instead or reset your password.'
      } else if (
        error?.code ===
        'auth/email-verification-required'
      ) {
        message =
          'Account created. Check your email and verify your address before logging in.'
      } else if (
        error?.code ===
        'auth/email-not-verified'
      ) {
        message =
          'Your email is not verified. A fresh verification link was sent. Check your inbox, then log in again.'
        setVerificationSent(true)
      } else if (
        error?.code ===
        'auth/too-many-requests'
      ) {
        message =
          'Too many login attempts. Please wait and try again later.'
      }

      push(
        message,
        'error'
      )

      captchaRef.current?.refresh()
      setCaptchaInput('')
    } finally {
      setBusy(false)
    }
  }

  async function handleResendVerification() {
    setBusy(true)

    try {
      await resendVerificationEmail(
        email,
        password
      )
      setVerificationSent(true)
      push(
        'A fresh verification link was sent. Check your inbox.',
        'success'
      )
    } catch (error: any) {
      push(
        error?.message ??
          'Could not resend the verification email.',
        'error'
      )
    } finally {
      setBusy(false)
    }
  }

  /*
   * Loading state
   */
  if (loading) {
    return (
      <div className="page-shell max-w-6xl">
        <div className="card text-center">
          Loading your account…
        </div>
      </div>
    )
  }

  /*
   * Redirect state
   */
  if (user) {
    return (
      <div className="page-shell max-w-6xl">
        <div className="card text-center">
          <p className="font-semibold">
            Opening your dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {mode === 'login'
            ? 'Welcome back'
            : 'Create your account'}
        </h1>

        <p className="text-ink/70 mt-1">
          {mode === 'login'
            ? 'Log in to track classes, mark presence and manage attendance.'
            : 'Sign up to start tracking classes and managing attendance.'}
        </p>
      </div>

      {/* DEMO MODE */}
      <div className="card-tint tint-sky mb-8">
        <h2 className="font-extrabold text-lg mb-1">
          ⚡ Demo Mode
        </h2>

        {!demoReady ? (
          <>
            <p className="text-sm text-ink/70 mb-3">
              One-time setup: creates real
              demo accounts and sample
              attendance data inside your
              existing Firebase project.
            </p>

            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={handleSetupDemo}
            >
              {busy
                ? demoStatus ||
                  'Setting up…'
                : 'Set up demo data'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/70 mb-3">
              Demo data is ready. Choose an
              account to jump directly into
              that dashboard.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-ink/50 mb-1">
                  STUDENTS · CR STATUS IS LIVE
                </div>

                {DEMO_LOGINS
                  .filter((item) =>
                    [
                      'Aarav Sharma',
                      'Priya Nair',
                      'Rohan Verma',
                    ].includes(item.name)
                  )
                  .map((item) => (
                    <button
                      key={item.email}
                      type="button"
                      disabled={busy}
                      className="btn-outline w-full mb-1 text-sm"
                      onClick={() =>
                        handleDemoLogin(
                          item.email
                        )
                      }
                    >
                      {item.name}
                    </button>
                  ))}
              </div>

              <div>
                <div className="text-xs font-semibold text-ink/50 mb-1">
                  TEACHERS
                </div>

                {DEMO_LOGINS
                  .filter(
                    (item) =>
                      item.role ===
                      'teacher'
                  )
                  .map((item) => (
                    <button
                      key={item.email}
                      type="button"
                      disabled={busy}
                      className="btn-outline w-full mb-1 text-sm"
                      onClick={() =>
                        handleDemoLogin(
                          item.email
                        )
                      }
                    >
                      {item.name}
                    </button>
                  ))}
              </div>
            </div>

            <button
              type="button"
              className="text-xs text-ink/40 underline mt-3"
              disabled={busy}
              onClick={handleSetupDemo}
            >
              Re-run setup / refresh demo
              data
            </button>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* AUTH */}
        <div className="card-tint tint-sky">
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              type="button"
              className={`btn-outline flex-1 min-w-[110px] ${
                mode === 'login'
                  ? 'is-active'
                  : ''
              }`}
              onClick={() =>
                switchMode('login')
              }
            >
              Log in
            </button>

            <button
              type="button"
              className={`btn-outline flex-1 min-w-[110px] ${
                mode === 'signup'
                  ? 'is-active'
                  : ''
              }`}
              onClick={() =>
                switchMode('signup')
              }
            >
              Sign up
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium">
                  Full name
                </label>

                <input
                  className="input"
                  required
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">
                Email
              </label>

              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(
                    event.target.value
                  )
                  setResetMessage('')
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Password
                </label>

                {mode === 'login' && (
                  <button
                    type="button"
                    className="forgot-password-btn"
                    disabled={
                      resettingPassword ||
                      busy
                    }
                    onClick={
                      handleForgotPassword
                    }
                  >
                    {resettingPassword
                      ? 'Sending…'
                      : 'Forgot password?'}
                  </button>
                )}
              </div>

              <input
                className="input mt-1"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
              />
            </div>

            {resetMessage && (
              <div
                className={`reset-message ${
                  resetMessage.includes(
                    'sent'
                  )
                    ? 'reset-success'
                    : 'reset-error'
                }`}
              >
                {resetMessage}
              </div>
            )}

            {verificationSent && mode === 'login' && (
              <button
                type="button"
                className="text-sm font-semibold underline"
                disabled={busy}
                onClick={handleResendVerification}
              >
                Resend verification email
              </button>
            )}

            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-sm font-medium">
                    Account type
                  </label>

                  <select
                    className="input"
                    value={role}
                    onChange={(event) =>
                      setRole(
                        event.target
                          .value as
                          | 'student'
                          | 'teacher'
                      )
                    }
                  >
                    <option value="student">
                      Student
                    </option>

                    <option value="teacher">
                      Teacher
                    </option>
                  </select>

                  <p className="text-xs text-ink/60 mt-1">
                    CR accounts are assigned
                    by a teacher from Manage
                    Classes.
                  </p>
                </div>

                {role ===
                  'student' && (
                  <StudentProgramPicker
                    program={
                      studentProgram
                    }
                    year={studentYear}
                    onProgramChange={
                      setStudentProgram
                    }
                    onYearChange={
                      setStudentYear
                    }
                  />
                )}

                {role ===
                  'teacher' && (
                  <TeacherSubjectPicker
                    value={
                      teacherSubjects
                    }
                    onChange={
                      setTeacherSubjects
                    }
                  />
                )}
              </>
            )}

            <Captcha
              ref={captchaRef}
              onRefresh={() =>
                setCaptchaInput('')
              }
            />

            <div>
              <input
                className="input"
                placeholder="Enter the code shown above"
                autoComplete="off"
                required
                value={captchaInput}
                onChange={(event) =>
                  setCaptchaInput(
                    event.target.value
                  )
                }
              />
            </div>

            <button
              className="btn-primary w-full"
              disabled={busy}
              type="submit"
            >
              {busy
                ? 'Please wait…'
                : mode === 'signup'
                ? 'Create account'
                : 'Log in'}
            </button>
          </form>
        </div>

        {/* ANNOUNCEMENTS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-lg">
              📢 Campus Announcements
            </h2>

            {announcements.length >
              3 && (
              <button
                type="button"
                className="text-sm font-semibold underline"
                onClick={() =>
                  setShowAll(true)
                }
              >
                View all
              </button>
            )}
          </div>

          <AnnouncementList
            items={announcements.slice(
              0,
              5
            )}
          />
        </div>
      </div>

      {showAll && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-40">
          <div className="card max-w-xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-lg">
                All announcements
              </h3>

              <button
                type="button"
                className="btn-outline text-sm"
                onClick={() =>
                  setShowAll(false)
                }
              >
                Close
              </button>
            </div>

            <AnnouncementList
              items={announcements}
            />
          </div>
        </div>
      )}
    </div>
  )
}