import { CheckCheck, CircleAlert, ClipboardList, Clock3, ListTodo, LoaderCircle, User } from 'lucide-react'

// Aggregates the visible tasks into one stats row per assignee, plus an
// "Unassigned" bucket. Members only pass their own tasks, so their report
// stays scoped to what they are allowed to see.
function buildUserRows(tasks, users) {
  const rows = new Map()

  function ensureRow(key, seed) {
    let row = rows.get(key)
    if (!row) {
      row = { key, name: '', username: '', total: 0, pending: 0, inProgress: 0, done: 0, isUnassigned: false, ...seed }
      rows.set(key, row)
    } else if (!row.name && seed.name) {
      row.name = seed.name
      if (!row.username) row.username = seed.username
    }
    return row
  }

  // Seed rows from the user list so teammates with zero tasks still appear.
  for (const user of users) {
    const id = user.id ?? user._id
    if (!id) continue
    ensureRow(String(id), { name: user.name ?? '', username: user.username ?? '' })
  }

  for (const task of tasks) {
    const row = task.assignee
      ? ensureRow(
          String(task.assignee._id ?? task.assignee.id ?? task.assignee.username ?? task.assignee.name),
          { name: task.assignee.name ?? '', username: task.assignee.username ?? '' },
        )
      : ensureRow('unassigned', { name: 'Unassigned', isUnassigned: true })

    row.total += 1
    if (task.status === 'todo') row.pending += 1
    else if (task.status === 'in-progress') row.inProgress += 1
    else if (task.status === 'done') row.done += 1
  }

  return [...rows.values()].sort((a, b) => {
    if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1
    if (b.total !== a.total) return b.total - a.total
    return (a.name || a.username).localeCompare(b.name || b.username)
  })
}

function Reports({ isLoading, loadError, onRetry, tasks, users = [] }) {
  const total = tasks.length
  const pending = tasks.filter((task) => task.status === 'todo').length
  const inProgress = tasks.filter((task) => task.status === 'in-progress').length
  const done = tasks.filter((task) => task.status === 'done').length
  const percentOf = (value) => (total > 0 ? Math.round((value / total) * 100) : 0)

  const rows = buildUserRows(tasks, users)

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">WORKSPACE INSIGHTS</p>
          <h1>Reports.</h1>
          <p className="welcome-subtitle">Totals, progress, and a user-wise breakdown of every task in view.</p>
        </div>
      </section>

      <section className="summary-grid" aria-label="Task summary">
        <div className="summary-item summary-total"><div className="summary-icon"><ListTodo size={18} /></div><span className="summary-label">Total tasks</span><strong>{total}</strong><span className="summary-note">in this view</span></div>
        <div className="summary-item summary-pending"><div className="summary-icon"><Clock3 size={18} /></div><span className="summary-label">Pending</span><strong>{pending}</strong><span className="summary-note">{percentOf(pending)}% of all tasks</span></div>
        <div className="summary-item summary-progress"><div className="summary-icon"><LoaderCircle size={18} /></div><span className="summary-label">In progress</span><strong>{inProgress}</strong><span className="summary-note">{percentOf(inProgress)}% of all tasks</span></div>
        <div className="summary-item summary-done"><div className="summary-icon"><CheckCheck size={18} /></div><span className="summary-label">Completed</span><strong>{done}</strong><span className="summary-note">{percentOf(done)}% of all tasks</span></div>
      </section>

      <section className="task-section">
        <div className="section-heading">
          <div>
            <h2>User-wise statistics</h2>
            <p>{rows.length} {rows.length === 1 ? 'assignee' : 'assignees'} · {total} {total === 1 ? 'task' : 'tasks'} counted</p>
          </div>
        </div>

        {isLoading ? (
          <div className="task-list" role="status" aria-label="Loading report data">
            <div className="task-skeleton-grid" aria-hidden="true">
              {[0, 1, 2].map((item) => (
                <div className="task-skeleton" key={item}>
                  <div className="skeleton-heading"><span /><span /></div>
                  <span className="skeleton-description" />
                  <span className="skeleton-date" />
                  <span className="skeleton-actions" />
                </div>
              ))}
            </div>
            <span className="visually-hidden">Loading report data</span>
          </div>
        ) : loadError ? (
          <div className="task-list">
            <div className="task-load-error" role="alert">
              <span className="load-error-icon"><CircleAlert size={19} /></span>
              <div className="task-load-error-copy"><strong>Reports could not be loaded</strong><p>{loadError}</p></div>
              <button className="subtle-button" type="button" onClick={onRetry}>Try again</button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="task-list">
            <div className="empty-state">
              <span className="empty-icon"><ClipboardList size={22} /></span>
              <h3>No task data yet</h3>
              <p>Once tasks are created, totals and user-wise statistics show up here.</p>
            </div>
          </div>
        ) : (
          <div className="stats-table-wrap">
            <table className="stats-table">
              <caption className="visually-hidden">Task statistics per user</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col" className="num">Total</th>
                  <th scope="col" className="num">Pending</th>
                  <th scope="col" className="num">In progress</th>
                  <th scope="col" className="num">Completed</th>
                  <th scope="col">Completion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rate = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
                  return (
                    <tr key={row.key}>
                      <td>
                        <div className="stats-member">
                          <span className={`stats-avatar${row.isUnassigned ? ' is-unassigned' : ''}`} aria-hidden="true">
                            {row.isUnassigned
                              ? <User size={15} />
                              : (row.name || row.username || '?').slice(0, 1).toUpperCase()}
                          </span>
                          <span className="stats-member-meta">
                            <strong>{row.name || (row.username ? `@${row.username}` : 'Unassigned')}</strong>
                            {row.username && !row.isUnassigned && <small>@{row.username}</small>}
                          </span>
                        </div>
                      </td>
                      <td className="num stats-total">{row.total}</td>
                      <td className="num stats-pending">{row.pending}</td>
                      <td className="num stats-progress">{row.inProgress}</td>
                      <td className="num stats-done">{row.done}</td>
                      <td>
                        <div className="stats-rate">
                          <span className="stats-bar"><span className="stats-bar-fill" style={{ width: `${rate}%` }} /></span>
                          <strong>{rate}%</strong>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {rows.length > 1 && (
                <tfoot>
                  <tr>
                    <td>All tasks</td>
                    <td className="num stats-total">{total}</td>
                    <td className="num stats-pending">{pending}</td>
                    <td className="num stats-progress">{inProgress}</td>
                    <td className="num stats-done">{done}</td>
                    <td>
                      <div className="stats-rate">
                        <span className="stats-bar"><span className="stats-bar-fill" style={{ width: `${percentOf(done)}%` }} /></span>
                        <strong>{percentOf(done)}%</strong>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default Reports
