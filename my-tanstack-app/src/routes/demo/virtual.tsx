import { useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'

export const Route = createFileRoute('/demo/virtual')({
  component: VirtualDemo,
})

// 10,000 rows — only the handful in view are ever rendered to the DOM.
const rows = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  label: `Row #${i + 1}`,
}))

function VirtualDemo() {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <main className="demo-page demo-center">
      <section className="demo-panel flex w-full max-w-xl flex-col gap-4">
        <p className="island-kicker">TanStack Virtual</p>
        <h1 className="demo-title mb-2">Virtualized List</h1>
        <p className="demo-muted m-0 text-sm">
          Scrolling {rows.length.toLocaleString()} rows while keeping only{' '}
          {virtualItems.length} in the DOM at a time.
        </p>

        <div
          ref={parentRef}
          className="demo-table-shell"
          style={{ height: 400, overflow: 'auto' }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <div
                  key={virtualRow.key}
                  className="flex items-center gap-3 border-b border-[var(--line)] px-4"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className="demo-pill">{row.id + 1}</span>
                  <span>{row.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="demo-muted m-0 text-sm">
          Rendered DOM nodes: {virtualItems.length} · Total rows:{' '}
          {rows.length.toLocaleString()}
        </p>
      </section>
    </main>
  )
}
