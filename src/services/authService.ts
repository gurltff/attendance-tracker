import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'

import { auth, isFirebaseConfigured } from './firebase'
import { getById, put } from './store'
import type { Role, UserProfile } from '../types'

export const LOCAL_AUTH_KEY = 'sat_local_auth_uid'
export const LOCAL_USERS_KEY = 'sat_local_users'
export const DEMO_MODE_KEY = 'sat_demo_mode'
const PENDING_PROFILE_KEY = 'sat_pending_profile'
let creatingFirebaseAccount = false

function now() {
  return Date.now()
}

function savePendingProfile(profile: UserProfile) {
  localStorage.setItem(
    `${PENDING_PROFILE_KEY}_${profile.uid}`,
    JSON.stringify(profile)
  )
}

function getPendingProfile(uid: string) {
  try {
    const raw = localStorage.getItem(
      `${PENDING_PROFILE_KEY}_${uid}`
    )
    return raw
      ? (JSON.parse(raw) as UserProfile)
      : null
  } catch {
    return null
  }
}

function clearPendingProfile(uid: string) {
  localStorage.removeItem(
    `${PENDING_PROFILE_KEY}_${uid}`
  )
}

async function materializePendingProfile(uid: string) {
  const existing = await getById<UserProfile>(
    'users',
    uid
  )

  if (existing) return

  const pending = getPendingProfile(uid)

  if (!pending) return

  await put<UserProfile & { id: string }>(
    'users',
    {
      ...pending,
      id: pending.uid,
    }
  )
  clearPendingProfile(uid)
}

function getLocalUsers(): Record<
  string,
  UserProfile & { password: string }
> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalUsers(
  users: Record<string, UserProfile & { password: string }>
) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

export function isDemoMode() {
  return localStorage.getItem(DEMO_MODE_KEY) === '1'
}

export function getLocalCurrentUid() {
  return localStorage.getItem(LOCAL_AUTH_KEY)
}

export function getLocalCurrentUser(): UserProfile | null {
  const uid = getLocalCurrentUid()

  if (!uid) return null

  const entry = getLocalUsers()[uid]

  if (!entry) return null

  const { password: _password, ...profile } = entry

  try {
    const raw = localStorage.getItem('sat_users')

    const storedUsers = raw
      ? (JSON.parse(raw) as UserProfile[])
      : []

    const storedProfile = storedUsers.find(
      (item) => item.uid === uid
    )

    if (storedProfile) {
      return {
        ...profile,
        ...storedProfile,
        uid,
        email: storedProfile.email ?? profile.email,
        name: storedProfile.name ?? profile.name,
      }
    }
  } catch {
    // Fall back to local auth profile.
  }

  return profile
}

export function syncLocalUserProfile(
  profile: UserProfile
) {
  const users = getLocalUsers()
  const existing = users[profile.uid]

  if (!existing) return

  users[profile.uid] = {
    ...existing,
    ...profile,
    password: existing.password,
  }

  saveLocalUsers(users)
}

function setLocalCurrentUid(uid: string | null) {
  if (uid) {
    localStorage.setItem(LOCAL_AUTH_KEY, uid)
  } else {
    localStorage.removeItem(LOCAL_AUTH_KEY)
  }
}

export function setDemoMode(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(DEMO_MODE_KEY, '1')
  } else {
    localStorage.removeItem(DEMO_MODE_KEY)
  }
}

export function notifyLocalAuthChanged() {
  window.dispatchEvent(
    new Event('sat-auth-changed')
  )
}

function validateRole(role: Role) {
  if (!['student', 'teacher', 'cr'].includes(role)) {
    throw new Error('Invalid user role.')
  }
}

export async function signUp(
  name: string,
  email: string,
  password: string,
  role: Role,
  options?: {
    enrolledCourseIds?: string[]
    assignedCourseIds?: string[]
    year?: string
  }
): Promise<UserProfile> {
  validateRole(role)

  if (role === 'cr') {
    throw new Error(
      'CR accounts cannot be registered directly. A teacher must assign CR status.'
    )
  }

  const cleanName = name.trim()
  const cleanEmail = email.trim().toLowerCase()

  if (!cleanName) {
    throw new Error('Please enter your full name.')
  }

  if (!cleanEmail) {
    throw new Error('Please enter your email address.')
  }

  if (password.length < 6) {
    throw new Error(
      'Password must be at least 6 characters.'
    )
  }

  if (isDemoMode()) {
    const users = getLocalUsers()

    if (
      Object.values(users).some(
        (u) =>
          u.email.toLowerCase() === cleanEmail
      )
    ) {
      throw new Error(
        'An account with this email already exists.'
      )
    }

    const uid = `local_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`

    const profile: UserProfile = {
      uid,
      name: cleanName,
      email: cleanEmail,
      role,
      createdAt: now(),
      ...(options?.enrolledCourseIds !== undefined
        ? { enrolledCourseIds: options.enrolledCourseIds }
        : {}),
      ...(options?.assignedCourseIds !== undefined
        ? { assignedCourseIds: options.assignedCourseIds }
        : {}),
      ...(options?.year !== undefined
        ? { year: options.year }
        : {}),
    }

    users[uid] = {
      ...profile,
      password,
    }

    saveLocalUsers(users)

    if (isDemoMode()) {
      setLocalCurrentUid(uid)
      notifyLocalAuthChanged()
    }

    return profile
  }

  if (!auth) {
    throw new Error(
      'Firebase authentication is not configured.'
    )
  }

  creatingFirebaseAccount = true

  let credential

  try {
    credential =
      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      )
  } catch (error) {
    creatingFirebaseAccount = false
    throw error
  }

  const profile: UserProfile = {
    uid: credential.user.uid,
    name: cleanName,
    email: cleanEmail,
    role,
    createdAt: now(),
    ...(options?.enrolledCourseIds !== undefined
      ? { enrolledCourseIds: options.enrolledCourseIds }
      : {}),
    ...(options?.assignedCourseIds !== undefined
      ? { assignedCourseIds: options.assignedCourseIds }
      : {}),
    ...(options?.year !== undefined
      ? { year: options.year }
      : {}),
  }

  try {
    savePendingProfile(profile)

    await sendEmailVerification(credential.user)
  } catch (error) {
    clearPendingProfile(profile.uid)
    await deleteUser(credential.user)
    throw error
  } finally {
    creatingFirebaseAccount = false
  }

  const verificationError = new Error(
    'Account created. Check your email and verify your address before logging in.'
  ) as Error & { code: string }
  verificationError.code =
    'auth/email-verification-required'
  throw verificationError
}

export async function logIn(
  email: string,
  password: string
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase()

  if (!cleanEmail || !password) {
    throw new Error(
      'Please enter your email and password.'
    )
  }

  if (isDemoMode()) {
    const entry = Object.values(
      getLocalUsers()
    ).find(
      (u) =>
        u.email.toLowerCase() === cleanEmail
    )

    if (
      !entry ||
      entry.password !== password
    ) {
      throw new Error(
        'Invalid demo email or password.'
      )
    }

    setLocalCurrentUid(entry.uid)
    notifyLocalAuthChanged()

    const {
      password: _password,
      ...profile
    } = entry

    return profile
  }

  if (!auth) {
    throw new Error(
      'Firebase authentication is not configured.'
    )
  }

  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    )

  if (!credential.user.emailVerified) {
    try {
      await sendEmailVerification(credential.user)
    } catch (error) {
      await signOut(auth)
      throw error
    }
    const verificationError = new Error(
      'Your email is not verified. A fresh verification link was sent. Open it within 10 minutes, then log in again.'
    ) as Error & { code: string }
    verificationError.code =
      'auth/email-not-verified'
    throw verificationError
  }

  await materializePendingProfile(
    credential.user.uid
  )

  const profile = await getById<UserProfile>(
    'users',
    credential.user.uid
  )

  if (!profile) {
    await signOut(auth)
    throw new Error(
      'Your account is missing an attendance profile. Please contact an administrator.'
    )
  }

  return profile
}

export async function resendVerificationEmail(
  email: string,
  password: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()

  if (!cleanEmail || !password) {
    throw new Error(
      'Enter your email and password first.'
    )
  }

  if (!auth) {
    throw new Error(
      'Firebase authentication is not configured.'
    )
  }

  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    )

  try {
    if (credential.user.emailVerified) {
      throw new Error(
        'This email is already verified. You can log in.'
      )
    }

    await sendEmailVerification(credential.user)
  } catch (error) {
    await signOut(auth)
    throw error
  }
}

/*
 * Demo login
 */
export async function logInDemo(
  email: string,
  password: string
): Promise<UserProfile> {
  setDemoMode(true)

  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth)
    } catch {
      // Already signed out.
    }
  }

  return logIn(email, password)
}

/*
 * Firebase forgot-password
 *
 * Demo accounts intentionally do not use Firebase
 * password reset because demo accounts are local.
 */
export async function resetPassword(
  email: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()

  if (!cleanEmail) {
    throw new Error(
      'Please enter your email address.'
    )
  }

  if (isDemoMode()) {
    throw new Error(
      'Password reset is not available for Demo Mode. Use a real Firebase account.'
    )
  }

  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured.'
    )
  }

  if (!auth) {
    throw new Error(
      'Firebase authentication is not configured.'
    )
  }

  await sendPasswordResetEmail(
    auth,
    cleanEmail
  )
}

/*
 * Logout
 */
export async function logOut(): Promise<void> {
  if (isDemoMode()) {
    setLocalCurrentUid(null)
    setDemoMode(false)
    notifyLocalAuthChanged()
    return
  }

  if (!isFirebaseConfigured) {
    setLocalCurrentUid(null)
    notifyLocalAuthChanged()
    return
  }

  if (!auth) {
    throw new Error(
      'Firebase authentication is not configured.'
    )
  }

  await signOut(auth)
}

/*
 * Authentication watcher
 */
export function watchAuthState(
  callback: (uid: string | null) => void
): () => void {
  const localHandler = () => {
    if (
      isDemoMode() ||
      !isFirebaseConfigured
    ) {
      callback(
        isDemoMode()
          ? getLocalCurrentUid()
          : null
      )
    }
  }

  window.addEventListener(
    'sat-auth-changed',
    localHandler
  )

  if (!isFirebaseConfigured || !auth) {
    callback(
      isDemoMode()
        ? getLocalCurrentUid()
        : null
    )

    return () =>
      window.removeEventListener(
        'sat-auth-changed',
        localHandler
      )
  }

  const firebaseAuth = auth
  let refreshInFlight = false

  const processFirebaseUser = async (
    firebaseUser: FirebaseUser | null
  ) => {
    if (refreshInFlight) return
    refreshInFlight = true

    try {
      if (!firebaseUser) {
        callback(null)
        return
      }

      await firebaseUser.reload()

      if (!firebaseUser.emailVerified) {
        callback(null)
        return
      }

      await materializePendingProfile(
        firebaseUser.uid
      )
      callback(firebaseUser.uid)
    } catch {
      callback(null)
    } finally {
      refreshInFlight = false
    }
  }

  const unsubscribe =
    onAuthStateChanged(
      firebaseAuth,
      (firebaseUser: FirebaseUser | null) => {
        if (isDemoMode()) {
          callback(
            getLocalCurrentUid()
          )
          return
        }

        void processFirebaseUser(firebaseUser)
      }
    )

  const refreshTimer = window.setInterval(() => {
    if (!isDemoMode()) {
      void processFirebaseUser(
        firebaseAuth.currentUser
      )
    }
  }, 2000)

  return () => {
    unsubscribe()
    window.clearInterval(refreshTimer)

    window.removeEventListener(
      'sat-auth-changed',
      localHandler
    )
  }
}

/*
 * Demo account compatibility helper
 */
export async function ensureDemoAccount(
  name: string,
  email: string,
  password: string,
  role: 'student' | 'teacher',
  options?: {
    enrolledCourseIds?: string[]
    assignedCourseIds?: string[]
    year?: string
  }
): Promise<UserProfile> {
  const users = getLocalUsers()

  const existing = Object.values(
    users
  ).find(
    (u) =>
      u.email.toLowerCase() ===
      email.trim().toLowerCase()
  )

  if (existing) {
    const updated: UserProfile = {
      ...existing,
      name,
      email: email
        .trim()
        .toLowerCase(),
      role,
      enrolledCourseIds:
        options?.enrolledCourseIds ??
        existing.enrolledCourseIds,
      assignedCourseIds:
        options?.assignedCourseIds ??
        existing.assignedCourseIds,
      year:
        options?.year ??
        existing.year,
    }

    users[existing.uid] = {
      ...updated,
      password: existing.password,
    }

    saveLocalUsers(users)

    return updated
  }

  const uid = `demo_${email
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '_')}`

  const profile: UserProfile = {
    uid,
    name,
    email: email.trim().toLowerCase(),
    role,
    enrolledCourseIds:
      options?.enrolledCourseIds,
    assignedCourseIds:
      options?.assignedCourseIds,
    year: options?.year,
    createdAt: now(),
  }

  users[uid] = {
    ...profile,
    password,
  }

  saveLocalUsers(users)

  return profile
}