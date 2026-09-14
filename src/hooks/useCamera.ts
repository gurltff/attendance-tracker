import { useRef, useState, useCallback, useEffect } from 'react'

const MAX_DIMENSION = 960 // caps output around ~150-300KB instead of several MB

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
    } catch (e) {
      setError('Camera permission denied or unavailable. Please allow camera access to continue.')
      setActive(false)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setActive(false)
  }, [])

  const capture = useCallback((overlayText?: string): string | null => {
    if (!videoRef.current) return null
    const video = videoRef.current

    // Scale down to a reasonable max dimension so the uploaded file stays small —
    // full camera resolution (often 1080p-4K) makes uploads slow for no real benefit
    // on a photo that's only ever viewed as a small attendance-verification thumbnail.
    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight))
    const width = Math.round(video.videoWidth * scale)
    const height = Math.round(video.videoHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, width, height)

    if (overlayText) {
      const barHeight = Math.max(20, canvas.height * 0.07)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight)
      ctx.fillStyle = '#ffffff'
      ctx.font = `${Math.max(10, barHeight * 0.4)}px sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(overlayText, 10, canvas.height - barHeight / 2)
    }

    return canvas.toDataURL('image/jpeg', 0.75)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, start, stop, capture, active, error }
}