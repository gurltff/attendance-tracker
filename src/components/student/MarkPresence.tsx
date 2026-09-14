import { useState } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { useGeolocation } from '../../hooks/useGeolocation'
import { create } from '../../services/store'
import { uploadAttendancePhoto } from '../../services/storageService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../Shared'
import { makeCourseKey } from '../../data/scheduleData'
import type {
  AttendanceRecord,
  Course,
} from '../../types'

const ALLOW_LOCATION_UNAVAILABLE = false

/* =========================================================
   ADD LOCATION + TIME TO PHOTO
   ========================================================= */

async function addLocationToPhoto(
  photoDataUrl: string,
  locationText: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')

        const maxDimension = 960

        const scale = Math.min(
          1,
          maxDimension /
            Math.max(img.width, img.height),
        )

        canvas.width = Math.round(
          img.width * scale,
        )

        canvas.height = Math.round(
          img.height * scale,
        )

        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(
            new Error(
              'Could not create photo canvas.',
            ),
          )
          return
        }

        /* Draw original photo */
        ctx.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height,
        )

        /* =================================================
           LOCATION STAMP
           ================================================= */

        const padding = Math.max(
          12,
          canvas.width * 0.025,
        )

        const fontSize = Math.max(
          14,
          Math.round(canvas.width * 0.025),
        )

        const lineHeight = fontSize * 1.45

        const lines = locationText.split('\n')

        const boxHeight =
          padding * 2 +
          lines.length * lineHeight

        /*
         * Dark transparent box at bottom.
         */
        ctx.fillStyle =
          'rgba(0, 0, 0, 0.72)'

        ctx.fillRect(
          0,
          canvas.height - boxHeight,
          canvas.width,
          boxHeight,
        )

        /*
         * White text.
         */
        ctx.fillStyle = '#ffffff'

        ctx.font =
          `600 ${fontSize}px Arial, sans-serif`

        ctx.textBaseline = 'top'

        lines.forEach((line, index) => {
          ctx.fillText(
            line,
            padding,
            canvas.height -
              boxHeight +
              padding +
              index * lineHeight,
          )
        })

        resolve(
          canvas.toDataURL(
            'image/jpeg',
            0.78,
          ),
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(
        new Error(
          'Could not load captured photo.',
        ),
      )
    }

    img.src = photoDataUrl
  })
}


/* =========================================================
   GOOGLE MAPS URL
   ========================================================= */

function createGoogleMapsUrl(
  latitude: number,
  longitude: number,
) {
  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    `${latitude},${longitude}`
  )
}


/* =========================================================
   COMPONENT
   ========================================================= */

export default function MarkPresence({
  courses,
  onSaved,
}: {
  courses: Course[]
  onSaved: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()

  const cam = useCamera()

  const {
    request: requestLocation,
  } = useGeolocation()

  const [courseId, setCourseId] =
    useState('')

  const [photo, setPhoto] =
    useState<string | null>(null)

  const [step, setStep] = useState<
    'select' | 'camera' | 'review' | 'done'
  >('select')

  const [submitting, setSubmitting] =
    useState(false)

  const [result, setResult] =
    useState<AttendanceRecord | null>(null)

  const [openSubmittedPhoto, setOpenSubmittedPhoto] =
    useState(false)

  const [photoLoadError, setPhotoLoadError] =
    useState(false)


  /* =======================================================
     START CAMERA
     ======================================================= */

  async function beginCamera() {
    if (!courseId) {
      push(
        'Please choose a course first.',
        'error',
      )

      return
    }

    setStep('camera')

    try {
      await cam.start()
    } catch {
      setStep('select')
    }
  }


  /* =======================================================
     TAKE PHOTO
     ======================================================= */

  function takePhoto() {
    const dataUrl = cam.capture()

    if (!dataUrl) {
      push(
        'Could not capture photo, try again.',
        'error',
      )

      return
    }

    setPhoto(dataUrl)

    cam.stop()

    setStep('review')
  }


  /* =======================================================
     SUBMIT ATTENDANCE
     ======================================================= */

  async function submit() {
    if (!user || !photo) return

    const course = courses.find(
      (item) => item.id === courseId,
    )

    if (!course) {
      push(
        'Selected course was not found.',
        'error',
      )

      return
    }

    if (!user.year) {
      push(
        'Your current year is missing from your profile.',
        'error',
      )

      return
    }

    const program =
      user.enrolledCourseIds?.[0]

    if (!program) {
      push(
        'Your programme is missing from your profile.',
        'error',
      )

      return
    }

    setSubmitting(true)

    try {
      /* =================================================
         STEP 1 — GET THIS PERSON'S CURRENT LOCATION
         ================================================= */

      const location =
        await requestLocation()

      if (
        location.status !== 'captured' &&
        !ALLOW_LOCATION_UNAVAILABLE
      ) {
        push(
          'Location is required to mark attendance here. Please enable location access.',
          'error',
        )

        return
      }


      /* =================================================
         STEP 2 — CREATE LOCATION STAMP
         ================================================= */

      const now = Date.now()

      let stampedPhoto = photo

      if (
        location.status === 'captured' &&
        location.geo
      ) {
        const latitude =
          location.geo.latitude.toFixed(6)

        const longitude =
          location.geo.longitude.toFixed(6)

        const accuracy =
          location.geo.accuracy !== undefined
            ? Math.round(
                location.geo.accuracy,
              )
            : null

        const dateText =
          new Date(now).toLocaleString()

        const locationText =
          `📍 Location: ${latitude}, ${longitude}\n` +
          `${
            accuracy !== null
              ? `Accuracy: ±${accuracy}m\n`
              : ''
          }` +
          `🕐 ${dateText}`

        /*
         * IMPORTANT:
         *
         * The location is added NOW, after getting
         * the current user's GPS coordinates.
         *
         * Therefore every uploaded photo receives
         * its own location.
         */
        stampedPhoto =
          await addLocationToPhoto(
            photo,
            locationText,
          )
      } else {
        /*
         * Location was unavailable but the app
         * allows submission.
         */
        stampedPhoto =
          await addLocationToPhoto(
            photo,
            `📍 Location unavailable\n` +
              `🕐 ${new Date(
                now,
              ).toLocaleString()}`,
          )
      }


      /* =================================================
         STEP 3 — SAVE PHOTO
         ================================================= */

      const photoUrl =
        await uploadAttendancePhoto(
          user.uid,
          courseId,
          stampedPhoto,
        )


      /* =================================================
         STEP 4 — CREATE ATTENDANCE RECORD
         ================================================= */

      const record: AttendanceRecord = {
        id: '',

        studentId: user.uid,

        studentName: user.name,

        courseId: course.id,

        courseName: course.name,

        courseKey: makeCourseKey(
          program,
          user.year,
          course.name,
        ),

        date: new Date()
          .toISOString()
          .slice(0, 10),

        status: 'present',

        source: 'student_self_checkin',

        photoUrl,

        photoTimestamp: now,

        geoTag:
          location.geo ?? undefined,

        locationStatus:
          location.status,

        createdAt: now,
      }


      /* =================================================
         STEP 5 — SAVE TO FIRESTORE / LOCAL STORAGE
         ================================================= */

      const id = await create(
        'attendanceRecords',
        record,
      )

      const savedRecord = {
        ...record,
        id,
      }

      setResult(savedRecord)

      setStep('done')

      onSaved()
    } catch (error) {
      console.error(error)

      push(
        'Failed to submit attendance. Please try again.',
        'error',
      )
    } finally {
      setSubmitting(false)
    }
  }


  /* =======================================================
     RESET
     ======================================================= */

  function reset() {
    setStep('select')

    setCourseId('')

    setPhoto(null)

    setResult(null)
  }


  /* =======================================================
     GOOGLE MAPS
     ======================================================= */

  function openGoogleMaps() {
    if (
      !result?.geoTag
    ) {
      return
    }

    const url =
      createGoogleMapsUrl(
        result.geoTag.latitude,
        result.geoTag.longitude,
      )

    window.open(
      url,
      '_blank',
      'noopener,noreferrer',
    )
  }


  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="card-tint tint-sage max-w-md">

      <h3 className="font-extrabold text-lg mb-2 text-ink">
        📍 Mark My Presence
      </h3>

      <p className="text-xs text-ink/70 mb-3">
        Your attendance photo is stamped with
        your current location and time.
      </p>


      {/* ===================================================
          SELECT COURSE
          =================================================== */}

      {step === 'select' && (
        <div className="space-y-3">

          <select
            className="input"
            value={courseId}
            onChange={(event) =>
              setCourseId(
                event.target.value,
              )
            }
          >
            <option value="">
              Select a course…
            </option>

            {courses.map((course) => (
              <option
                key={course.id}
                value={course.id}
              >
                {course.name}
              </option>
            ))}
          </select>

          <p className="text-xs text-ink/60">
            Camera and location permissions
            may be requested. This requires
            HTTPS or localhost.
          </p>

          <button
            type="button"
            className="btn-primary w-full"
            onClick={beginCamera}
          >
            Start check-in
          </button>

        </div>
      )}


      {/* ===================================================
          CAMERA
          =================================================== */}

      {step === 'camera' && (
        <div className="space-y-3">

          {cam.error && (
            <p className="text-sm font-semibold text-[#C0392B]">
              {cam.error}
            </p>
          )}

          <video
            ref={cam.videoRef}
            className="
              w-full
              rounded-2xl
              border-2
              border-ink
              bg-ink
              aspect-video
            "
            muted
            playsInline
          />

          <div className="flex gap-2">

            <button
              type="button"
              className="btn-outline flex-1"
              onClick={() => {
                cam.stop()
                setStep('select')
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!cam.active}
              onClick={takePhoto}
            >
              Capture photo
            </button>

          </div>

        </div>
      )}


      {/* ===================================================
          PHOTO REVIEW
          =================================================== */}

      {step === 'review' && photo && (
        <div className="space-y-3">

          <div>
            <img
              src={photo}
              alt="Captured attendance photo"
              className="
                w-full
                rounded-2xl
                border-2
                border-ink
              "
            />

            <p className="
              text-xs
              text-ink/60
              mt-2
              text-center
            ">
              📍 Your exact location will be
              added to this photo when you
              submit it.
            </p>
          </div>


          <div className="flex gap-2">

            <button
              type="button"
              className="btn-outline flex-1"
              disabled={submitting}
              onClick={() => {
                setPhoto(null)
                setStep('select')
              }}
            >
              Retake
            </button>

            <button
              type="button"
              className="btn-primary flex-1"
              disabled={submitting}
              onClick={submit}
            >
              {submitting
                ? 'Getting location…'
                : 'Confirm & submit'}
            </button>

          </div>

        </div>
      )}


      {/* ===================================================
          DONE
          =================================================== */}

      {step === 'done' && result && (
        <div className="space-y-3 text-sm text-ink">

          <p className="font-extrabold text-base">
            ✅ Attendance marked!
          </p>

          <p>
            <strong>Course:</strong>{' '}
            {result.courseName}
          </p>

          <p>
            <strong>Date:</strong>{' '}
            {result.date}
          </p>

          <p>
            <strong>Time:</strong>{' '}
            {result.photoTimestamp
              ? new Date(
                  result.photoTimestamp,
                ).toLocaleTimeString()
              : '—'}
          </p>


          {/* LOCATION */}

          {result.locationStatus ===
            'captured' &&
            result.geoTag ? (
            <div className="
              rounded-2xl
              border-2
              border-ink
              bg-cream-soft/50
              p-3
              space-y-2
            ">

              <p className="font-extrabold">
                📍 Location captured
              </p>

              <p className="text-xs">
                Latitude:{' '}
                {result.geoTag.latitude.toFixed(
                  6,
                )}
              </p>

              <p className="text-xs">
                Longitude:{' '}
                {result.geoTag.longitude.toFixed(
                  6,
                )}
              </p>

              {result.geoTag.accuracy !==
                undefined && (
                <p className="text-xs">
                  Accuracy: ±
                  {Math.round(
                    result.geoTag.accuracy,
                  )}
                  m
                </p>
              )}

              <button
                type="button"
                className="btn-primary w-full"
                onClick={
                  openGoogleMaps
                }
              >
                🗺️ Open in Google Maps
              </button>

            </div>
          ) : (
            <p>
              <strong>Location:</strong>{' '}
              {result.locationStatus ===
              'denied'
                ? 'permission denied ⚠️'
                : 'unavailable ⚠️'}
            </p>
          )}


          {/* PHOTO */}

          {result.photoUrl && (
            <div className="space-y-2">

              <p className="font-bold">
                📸 Attendance photo
              </p>

              <img
                src={result.photoUrl}
                alt="Attendance with location stamp"
                className="
                  w-full
                  rounded-2xl
                  border-2
                  border-ink
                  cursor-zoom-in
                "
                onError={() => setPhotoLoadError(true)}
                onClick={() => {
                  setPhotoLoadError(false)
                  setOpenSubmittedPhoto(true)
                }}
              />

            </div>
          )}


          <button
            type="button"
            className="btn-outline w-full"
            onClick={reset}
          >
            Mark another
          </button>

          {openSubmittedPhoto && result.photoUrl && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Your attendance photo"
              onClick={() => setOpenSubmittedPhoto(false)}
            >
              <div className="relative max-h-full max-w-3xl">
                {photoLoadError ? (
                  <p className="rounded-2xl bg-cream-soft px-6 py-5 font-semibold text-ink">
                    This attendance photo could not be displayed.
                  </p>
                ) : (
                  <img
                    src={result.photoUrl}
                    alt="Your attendance check-in"
                    className="max-h-[85vh] max-w-full rounded-2xl border-2 border-cream-soft object-contain"
                    onError={() => setPhotoLoadError(true)}
                    onClick={(event) => event.stopPropagation()}
                  />
                )}

                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-ink px-3 py-1 text-lg font-bold text-cream-soft"
                  aria-label="Close photo"
                  onClick={() => setOpenSubmittedPhoto(false)}
                >
                  ×
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}