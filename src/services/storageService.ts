// NOTE: We intentionally do NOT use Firebase Storage here. Storage requires the
// Blaze (pay-as-you-go) billing plan to even create a bucket, which needs a card
// on file. Instead we compress the photo client-side and store it as a base64
// data URL directly on the Firestore attendance document (free tier, no billing
// upgrade needed). Firestore documents cap out at 1MB, so we resize + compress
// aggressively to comfortably fit a JPEG selfie under that limit.

const MAX_DIMENSION = 480 // px, longest side
const JPEG_QUALITY = 0.6 // 0-1

/** Resizes/recompresses a base64 JPEG data URL so it safely fits in a Firestore field. */
function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width)
        width = MAX_DIMENSION
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height)
        height = MAX_DIMENSION
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not get canvas context'))
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => reject(new Error('Could not load captured photo for compression'))
    img.src = dataUrl
  })
}

/**
 * Compresses a base64 JPEG data URL and returns it directly — this value gets
 * stored as the `photoUrl` field on the attendance record in Firestore.
 */
export async function uploadAttendancePhoto(
  _studentId: string,
  _courseId: string,
  dataUrl: string
): Promise<string> {
  const compressed = await compressDataUrl(dataUrl)
  if (compressed.length > 900_000) {
    // ~900KB base64 leaves headroom under Firestore's 1MB document limit.
    throw new Error('Photo is too large even after compression — please retake in better light or closer up.')
  }
  return compressed
}