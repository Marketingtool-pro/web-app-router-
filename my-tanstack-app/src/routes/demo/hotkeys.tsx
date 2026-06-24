import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useHeldKeys, useHotkey } from '@tanstack/react-hotkeys'

export const Route = createFileRoute('/demo/hotkeys')({
  component: HotkeysDemo,
})

function HotkeysDemo() {
  const [count, setCount] = useState(0)
  const [log, setLog] = useState<Array<string>>([])
  const [saved, setSaved] = useState(false)

  // `Mod` resolves to ⌘ on macOS and Ctrl elsewhere — no platform branching.
  // Callbacks are re-synced every render, so they always see the latest state.
  useHotkey('Mod+S', (event) => {
    event.preventDefault()
    setSaved(true)
    pushLog('Mod+S → saved')
    setTimeout(() => setSaved(false), 1200)
  })

  useHotkey('Mod+ArrowUp', (event) => {
    event.preventDefault()
    setCount((c) => c + 1)
    pushLog('Mod+↑ → increment')
  })

  useHotkey('Mod+ArrowDown', (event) => {
    event.preventDefault()
    setCount((c) => c - 1)
    pushLog('Mod+↓ → decrement')
  })

  useHotkey('Escape', () => {
    setCount(0)
    pushLog('Escape → reset')
  })

  // Live view of currently held keys, sourced from the singleton key tracker.
  const heldKeys = useHeldKeys()

  function pushLog(entry: string) {
    setLog((prev) => [entry, ...prev].slice(0, 6))
  }

  return (
    <main className="demo-page demo-center">
      <section className="demo-panel flex w-full max-w-xl flex-col gap-4">
        <p className="island-kicker">TanStack Hotkeys</p>
        <h1 className="demo-title mb-2">Keyboard Shortcuts</h1>
        <p className="demo-muted m-0 text-sm">
          Focus this page and try the shortcuts below. Bindings register with a
          singleton manager and stay in sync with React state.
        </p>

        <div className="demo-list-item flex items-center justify-between">
          <span className="font-medium">Counter</span>
          <span className="demo-title text-3xl">{count}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Mod + S', 'Save'],
            ['Mod + ↑', 'Increment'],
            ['Mod + ↓', 'Decrement'],
            ['Escape', 'Reset'],
          ].map(([combo, label]) => (
            <div key={combo} className="demo-list-item flex items-center gap-2">
              <kbd className="demo-pill">{combo}</kbd>
              <span className="demo-muted">{label}</span>
            </div>
          ))}
        </div>

        {saved ? <div className="demo-alert">Saved! (intercepted Mod+S)</div> : null}

        <div>
          <p className="demo-section-title mb-2">Currently held</p>
          <div className="flex min-h-9 flex-wrap gap-2">
            {heldKeys.length === 0 ? (
              <span className="demo-muted text-sm">Nothing pressed</span>
            ) : (
              heldKeys.map((key) => (
                <kbd key={key} className="demo-pill">
                  {key}
                </kbd>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="demo-section-title mb-2">Event log</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {log.length === 0 ? (
              <li className="demo-muted">No shortcuts fired yet</li>
            ) : (
              log.map((entry, i) => (
                <li key={`${entry}-${i}`} className="demo-muted">
                  {entry}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  )
}
