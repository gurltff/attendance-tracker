import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

/*
 * Lightweight, self-hosted CAPTCHA.
 *
 * Draws a short distorted code onto a <canvas> (with noise
 * lines + per-character rotation/offset so it can't be read
 * via the DOM/innerText) and asks the user to retype it.
 *
 * No external service or API key required, so it works
 * everywhere this app is deployed.
 */

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

function randomCode(length = 5) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return out
}

export interface CaptchaHandle {
  /** Returns true if the current user input matches the code, case-insensitive. */
  verify: (input: string) => boolean
  /** Generates a fresh code (call after a failed submit or on demand). */
  refresh: () => void
}

interface CaptchaProps {
  /** Called whenever the code is (re)generated, in case a parent wants the raw value for its own checks. */
  onRefresh?: () => void
}

function drawCaptcha(canvas: HTMLCanvasElement, code: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height } = canvas

  ctx.clearRect(0, 0, width, height)

  // Background
  ctx.fillStyle = '#eef1f6'
  ctx.fillRect(0, 0, width, height)

  // Noise lines
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(${Math.floor(
      Math.random() * 120
    )}, ${Math.floor(Math.random() * 120)}, ${Math.floor(
      Math.random() * 120
    )}, 0.35)`
    ctx.beginPath()
    ctx.moveTo(Math.random() * width, Math.random() * height)
    ctx.lineTo(Math.random() * width, Math.random() * height)
    ctx.stroke()
  }

  // Noise dots
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${Math.floor(
      Math.random() * 150
    )}, ${Math.floor(Math.random() * 150)}, ${Math.floor(
      Math.random() * 150
    )}, 0.4)`
    ctx.beginPath()
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      1.4,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }

  // Characters
  const charWidth = width / (code.length + 1)

  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    const x = charWidth * (i + 0.85)
    const y = height / 2 + (Math.random() * 10 - 5)
    const angle = (Math.random() * 30 - 15) * (Math.PI / 180)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.font = `bold ${Math.floor(height * 0.55)}px monospace`
    ctx.fillStyle = `hsl(${Math.floor(
      Math.random() * 360
    )}, 45%, 32%)`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(char, 0, 0)
    ctx.restore()
  }
}

const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(
  function Captcha({ onRefresh }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [code, setCode] = useState('')

    function generate() {
      const next = randomCode()
      setCode(next)
      onRefresh?.()
    }

    useEffect(() => {
      generate()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      if (canvasRef.current && code) {
        drawCaptcha(canvasRef.current, code)
      }
    }, [code])

    useImperativeHandle(ref, () => ({
      verify: (input: string) =>
        !!code &&
        input.trim().toUpperCase() === code.toUpperCase(),
      refresh: generate,
    }))

    return (
      <div>
        <label className="text-sm font-medium">
          Security check
        </label>

        <div className="flex items-center gap-2 mt-1">
          <canvas
            ref={canvasRef}
            width={160}
            height={50}
            role="img"
            aria-label="CAPTCHA image. If you cannot read it, use the refresh button to get a new one."
            style={{
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />

          <button
            type="button"
            className="btn-outline text-sm"
            onClick={generate}
            aria-label="Get a new CAPTCHA code"
            title="Get a new code"
          >
            ⟳
          </button>
        </div>
      </div>
    )
  }
)

export default Captcha
