import { useState } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import {
  createCollection,
  eq,
  localOnlyCollectionOptions,
  useLiveQuery,
} from '@tanstack/react-db'

export const Route = createFileRoute('/demo/db')({
  component: DbDemo,
})

type Todo = { id: number; text: string; done: boolean }

const seedTodos: Array<Todo> = [
  { id: 1, text: 'Scaffold the app with the TanStack CLI', done: true },
  { id: 2, text: 'Wire up a TanStack DB live-query collection', done: false },
  { id: 3, text: 'Ship the desktop result UI', done: false },
]

// A client-only ("local-only") collection: an in-memory reactive store that
// useLiveQuery can subscribe to. Swap localOnlyCollectionOptions for a
// queryCollectionOptions / electric / trailbase sync layer to make it durable.
const todoCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (todo: Todo) => todo.id,
    initialData: seedTodos,
  }),
)

let nextId = seedTodos.length + 1

function DbDemo() {
  return (
    <main className="demo-page demo-center">
      <section className="demo-panel flex w-full max-w-xl flex-col gap-4">
        <p className="island-kicker">TanStack DB</p>
        <h1 className="demo-title mb-2">Live Query Collection</h1>
        <p className="demo-muted m-0 text-sm">
          A local-only collection rendered through <code>useLiveQuery</code>.
          Every mutation flows back into the query and re-renders automatically.
        </p>

        {/* Live queries are a client concern (no SSR snapshot), so the
            interactive list is rendered inside a ClientOnly boundary. */}
        <ClientOnly fallback={<TodoSkeleton />}>
          <TodoList />
        </ClientOnly>
      </section>
    </main>
  )
}

function TodoList() {
  const [text, setText] = useState('')
  const [hideDone, setHideDone] = useState(false)

  // Live query — re-runs reactively whenever the collection or deps change.
  const { data: todos } = useLiveQuery(
    (q) => {
      const base = q
        .from({ todo: todoCollection })
        .orderBy(({ todo }) => todo.id)
      return hideDone ? base.where(({ todo }) => eq(todo.done, false)) : base
    },
    [hideDone],
  )

  const remaining = todos.filter((t) => !t.done).length

  function addTodo() {
    const value = text.trim()
    if (!value) return
    todoCollection.insert({ id: nextId++, text: value, done: false })
    setText('')
  }

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          placeholder="Add a todo..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          className="demo-input"
        />
        <button className="demo-button" onClick={addTodo}>
          Add
        </button>
      </div>

      <label className="demo-muted flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hideDone}
          onChange={(e) => setHideDone(e.target.checked)}
        />
        Hide completed
      </label>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className="demo-list-item flex items-center justify-between gap-3"
          >
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() =>
                  todoCollection.update(todo.id, (draft) => {
                    draft.done = !draft.done
                  })
                }
              />
              <span className={todo.done ? 'line-through opacity-60' : ''}>
                {todo.text}
              </span>
            </label>
            <button
              className="demo-button demo-button-danger"
              onClick={() => todoCollection.delete(todo.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <p className="demo-muted m-0 text-sm">
        {remaining} remaining · {todos.length} shown
      </p>
    </>
  )
}

function TodoSkeleton() {
  return (
    <div className="demo-muted text-sm" aria-hidden>
      Loading collection…
    </div>
  )
}
