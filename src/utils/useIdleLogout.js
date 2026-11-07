import { useEffect, useRef, useState } from 'react'

// Sign a login out after a stretch with no use. "Use" is any click, key,
// scroll or mouse movement in ANY tab of the app — the last-active time is
// kept in localStorage, so a second tab left open does not log out the one
// being worked in, and a laptop that slept past the limit logs out the moment
// it wakes. markActive() is called at sign-in so an old timestamp from a
// previous session cannot log a fresh login straight back out.

export const IDLE_MINUTES = 15
const WARN_SECONDS = 60

export function markActive(key) {
  try { localStorage.setItem(key, String(Date.now())) } catch { /* storage unavailable */ }
}

function lastActive(key) {
  try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 }
}

// Returns { secondsLeft, stay }: secondsLeft is a number during the last
// minute (show a warning), otherwise null. stay() counts as activity.
export function useIdleLogout({ enabled, storageKey, onTimeout, minutes = IDLE_MINUTES }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => { onTimeoutRef.current = onTimeout }, [onTimeout])

  useEffect(() => {
    if (!enabled) return undefined
    const limit = minutes * 60 * 1000
    let done = false

    // A page opened long after the last activity (sleep, a closed laptop, a
    // tab reopened next morning) is already past the limit.
    const seen = lastActive(storageKey)
    if (!seen) markActive(storageKey)

    let lastWrite = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastWrite < 5000) return   // mousemove fires constantly
      lastWrite = now
      markActive(storageKey)
    }
    const check = () => {
      if (done) return
      const idle = Date.now() - (lastActive(storageKey) || Date.now())
      if (idle >= limit) {
        done = true
        setSecondsLeft(null)
        onTimeoutRef.current?.()
        return
      }
      const left = Math.ceil((limit - idle) / 1000)
      setSecondsLeft(left <= WARN_SECONDS ? left : null)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart']
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, 1000)
    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [enabled, storageKey, minutes])

  return { secondsLeft, stay: () => { markActive(storageKey); setSecondsLeft(null) } }
}
