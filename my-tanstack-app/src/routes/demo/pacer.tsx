import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  useDebouncedValue,
  useThrottledValue,
} from '@tanstack/react-pacer'

export const Route = createFileRoute('/demo/pacer')({
  component: PacerDemo,
})

function PacerDemo() {
  const [text, setText] = useState('')

  // Debounce: only settles `wait` ms after the user stops typing.
  const [debounced] = useDebouncedValue(text, { wait: 500 })

  // Throttle: updates at most once per `wait` ms while typing continuously.
  const [throttled] = useThrottledValue(text, { wait: 500 })

  // Count how often each derived value actually changes — the whole point of
  // pacing is fewer downstream updates than raw keystrokes.
  const rawCount = useChangeCount(text)
  const debouncedCount = useChangeCount(debounced)
  const throttledCount = useChangeCount(throttled)

  return (
    <main className="demo-page demo-center">
      <section className="demo-panel flex w-full max-w-xl flex-col gap-4">
        <p className="island-kicker">TanStack Pacer</p>
        <h1 className="demo-title mb-2">Debounce &amp; Throttle</h1>
        <p className="demo-muted m-0 text-sm">
          Type quickly and watch how debouncing and throttling collapse a burst
          of keystrokes into far fewer downstream updates.
        </p>

        <input
          type="text"
          value={text}
          placeholder="Start typing..."
          onChange={(e) => setText(e.target.value)}
          className="demo-input"
        />

        <div className="flex flex-col gap-3">
          <PacerRow
            label="Raw value"
            value={text}
            count={rawCount}
            tone="raw"
          />
          <PacerRow
            label="Debounced (500ms)"
            value={debounced}
            count={debouncedCount}
            tone="debounced"
          />
          <PacerRow
            label="Throttled (500ms)"
            value={throttled}
            count={throttledCount}
            tone="throttled"
          />
        </div>
      </section>
    </main>
  )
}

function PacerRow({
  label,
  value,
  count,
  tone,
}: {
  label: string
  value: string
  count: number
  tone: 'raw' | 'debounced' | 'throttled'
}) {
  return (
    <div className="demo-list-item flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="demo-section-title">{label}</span>
        <span className="demo-pill">{count} updates</span>
      </div>
      <code className="demo-muted min-h-5 break-all">
        {value || (tone === 'raw' ? '—' : 'waiting...')}
      </code>
    </div>
  )
}

// Tiny helper that counts how many times a value has changed.
function useChangeCount(value: string) {
  const [count, setCount] = useState(0)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setCount((c) => c + 1)
    }
  }, [value])
  return count
}
