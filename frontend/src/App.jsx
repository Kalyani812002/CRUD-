import { useEffect, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCheck,
  CircleAlert,
  ClipboardList,
  Clock3,
  Eye,
  House,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Users as UsersIcon,
  X,
} from 'lucide-react'
import TaskForm from './TaskForm.jsx'
import Users from './Users.jsx'
import Reports from './Reports.jsx'
import Login from './Login.jsx'
import { clearSession, readSession } from './auth.js'
import { apiRequest } from './api.js'
import './App.css'

const views = [
  { id: 'all', label: 'All tasks', icon: LayoutDashboard },
  { id: 'todo', label: 'Pending', icon: Clock3 },
  { id: 'in-progress', label: 'In progress', icon: LoaderCircle },
  { id: 'done', label: 'Completed', icon: CheckCheck },
]

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'all', label: 'All Tasks', icon: ClipboardList },
  { id: 'todo', label: 'Pending', icon: Clock3 },
  { id: 'in-progress', label: 'In Process', icon: LoaderCircle },
  { id: 'done', label: 'Completed', icon: CheckCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: UsersIcon, adminOnly: true },
  { id: 'create', label: 'Create Task', icon: Plus, isAction: true },
  { id: 'trash', label: 'Trash', icon: Trash2 },
]

const statusLabels = {
  todo: 'Pending',
  'in-progress': 'In progress',
  done: 'Done',
}

const apiStatusByUiStatus = {
  todo: 'Pending',
  'in-progress': 'In Progress',
  done: 'Done',
}

const uiStatusByApiStatus = {
  Pending: 'todo',
  'In Progress': 'in-progress',
  Done: 'done',
}

function normalizeTask(task) {
  const apiStatus = Object.hasOwn(uiStatusByApiStatus, task.status)
    ? task.status
    : apiStatusByUiStatus[task.status] ?? 'Pending'
  return {
    ...task,
    id: task._id ?? task.id,
    apiStatus,
    status: uiStatusByApiStatus[apiStatus] ?? task.status ?? 'todo',
    description: task.description ?? '',
    assignee: task.assignee && typeof task.assignee === 'object'
      ? {
          _id: task.assignee._id ?? task.assignee.id,
          name: task.assignee.name ?? '',
          username: task.assignee.username ?? '',
        }
      : null,
  }
}

async function fetchTasks(options) {
  const tasks = await apiRequest('/api/tasks', options)
  return tasks.map(normalizeTask)
}

function formatCreatedDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function App() {
  const [session, setSession] = useState(() => readSession())
  // Session can be null (fresh browser / expired login) — the guard at the
  // bottom of this function renders <Login> in that case, so every pre-guard
  // read must tolerate null.
  const isAdmin = session?.isAdmin === true
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeView, setActiveView] = useState('all')
  const [search, setSearch] = useState('')
  const [editingTask, setEditingTask] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [taskToView, setTaskToView] = useState(null)
  const [teamUsers, setTeamUsers] = useState([])
  // Non-admins never see the Users nav item; fall back to the task list if the
  // view is somehow active without admin access (e.g. a stale session).
  const isUsersView = activeView === 'users' && isAdmin
  const isReportsView = activeView === 'reports'

  useEffect(() => {
    if (!session) return undefined
    const controller = new AbortController()
    fetchTasks({ signal: controller.signal })
      .then(setTasks)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [session])

  useEffect(() => {
    if (!isAdmin) return undefined
    let isActive = true
    apiRequest('/api/users')
      .then((result) => {
        if (!isActive) return
        setTeamUsers((Array.isArray(result) ? result : []).map((user) => ({ ...user, id: user._id ?? user.id })))
      })
      .catch(() => {
        // The assignee dropdown stays empty; the rest of task CRUD still works.
      })
    return () => {
      isActive = false
    }
  }, [isAdmin])

  function handleLogout() {
    clearSession()
    setSession(null)
    setTasks([])
    setIsLoading(true)
    setLoadError('')
    setApiError('')
    setSuccessMessage('')
    setSearch('')
    setActiveView('all')
    setEditingTask(null)
    setIsFormOpen(false)
    setTaskToDelete(null)
    setTaskToView(null)
  }

  async function retryLoad() {
    setIsLoading(true)
    setLoadError('')
    try {
      setTasks(await fetchTasks())
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Members (non-admin password accounts) only see tasks assigned to them.
  const isMemberSession = session?.provider === 'credentials' && !isAdmin
  const visibleTasks = isMemberSession
    ? tasks.filter((task) => task.assignee && (
        task.assignee._id === session.userId || task.assignee.username === session.username
      ))
    : tasks

  const counts = {
    all: visibleTasks.length,
    todo: visibleTasks.filter((task) => task.status === 'todo').length,
    'in-progress': visibleTasks.filter((task) => task.status === 'in-progress').length,
    done: visibleTasks.filter((task) => task.status === 'done').length,
    dashboard: visibleTasks.length,
    trash: 0,
  }

  const currentView = views.find((view) => view.id === activeView)
    ?? sidebarItems.find((item) => item.id === activeView)
  const filteredTasks = activeView === 'trash'
    ? []
    : visibleTasks.filter((task) => {
        const matchesView = activeView === 'all' || activeView === 'dashboard' || task.status === activeView
        const matchesSearch = `${task.title} ${task.description}`
          .toLowerCase()
          .includes(search.toLowerCase())
        return matchesView && matchesSearch
      })

  async function saveTask(task) {
    setIsSaving(true)
    setFormError('')
    setApiError('')
    try {
      const isEditing = Boolean(editingTask)
      const payload = { ...task }
      // Members who create a task stay its assignee so it remains visible to them.
      if (!isEditing && isMemberSession && session.userId) payload.assignee = session.userId
      const responseTask = await apiRequest(
        isEditing ? `/api/tasks/${encodeURIComponent(editingTask.id)}` : '/api/tasks',
        { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      )
      const savedTask = normalizeTask(responseTask)
      setLoadError('')
      if (isEditing) {
        setTasks((currentTasks) => currentTasks.map((currentTask) => (
          currentTask.id === savedTask.id ? savedTask : currentTask
        )))
        try {
          setTasks(await fetchTasks())
        } catch (error) {
          setApiError(`Task updated, but the list could not refresh: ${error.message}`)
        }
      } else {
        setTasks((currentTasks) => [savedTask, ...currentTasks])
      }
      setSuccessMessage(isEditing ? 'Task updated successfully.' : 'Task created successfully.')
      setIsFormOpen(false)
      setEditingTask(null)
    } catch (error) {
      setSuccessMessage('')
      setFormError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function openNewTask() {
    setEditingTask(null)
    setApiError('')
    setFormError('')
    setSuccessMessage('')
    setIsFormOpen(true)
  }

  function openEditTask(task) {
    setEditingTask(task)
    setApiError('')
    setFormError('')
    setSuccessMessage('')
    setIsFormOpen(true)
  }

  function openViewTask(task) {
    setTaskToView(task)
    setApiError('')
    setSuccessMessage('')
  }

  function requestTaskDelete(task) {
    setTaskToDelete(task)
    setDeleteError('')
    setApiError('')
    setSuccessMessage('')
  }

  async function confirmTaskDelete() {
    if (!taskToDelete) return

    setIsDeleting(true)
    setDeleteError('')
    try {
      await apiRequest(`/api/tasks/${encodeURIComponent(taskToDelete.id)}`, { method: 'DELETE' })
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskToDelete.id))
      setSuccessMessage(`${taskToDelete.title} was deleted successfully.`)
      setTaskToDelete(null)
    } catch (error) {
      setDeleteError(error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!session) return <Login onLogin={setSession} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={() => setActiveView('all')}>
          <span className="brand-mark"><Check size={18} strokeWidth={3} /></span>
          <span>Daymark<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-label">VIEWS</div>
        <nav className="primary-nav" aria-label="Task views">
          {sidebarItems.filter((item) => !item.adminOnly || isAdmin).map(({ id, label, icon: Icon, isAction }) => {
            const isActive = !isAction && activeView === id
            return (
              <button
                className={`nav-item ${isActive ? 'is-active' : ''}`}
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={isAction ? openNewTask : () => setActiveView(id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {!isAction && counts[id] !== undefined && <span className="nav-count">{counts[id]}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-avatar" aria-hidden="true">{(session.name || session.username).slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-user-meta">
              <strong>{session.name || session.username}</strong>
              <small>Signed in</small>
            </span>
          </div>
          <button className="nav-item logout-item" type="button" onClick={handleLogout}>
            <LogOut size={18} strokeWidth={1.8} />
            <span>Log out</span>
          </button>
        </div>

      </aside>

      <main className="main-area" id="home">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{currentView?.label}</strong></div>
          <div className="topbar-date"><CalendarDays size={15} />
            {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
          </div>
        </header>

        <div className="content-wrap">
          {apiError && <p className="api-error" role="alert">{apiError}</p>}
          {successMessage && <p className="api-success" role="status">{successMessage}</p>}
          {isUsersView ? (
            <Users />
          ) : isReportsView ? (
            <Reports
              isLoading={isLoading}
              loadError={loadError}
              onRetry={retryLoad}
              tasks={visibleTasks}
              users={teamUsers}
            />
          ) : (
            <>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR DAY, IN FOCUS</p>
              <h1>{activeView === 'all' ? 'Good work starts here.' : currentView?.label}</h1>
              <p className="welcome-subtitle">A little structure goes a long way. What needs your attention?</p>
            </div>
            <button className="primary-button" type="button" onClick={openNewTask}>
              <Plus size={18} strokeWidth={2.3} /> <span>New task</span>
            </button>
          </section>

          <section className="summary-grid" aria-label="Task summary">
            <div className="summary-item summary-total"><div className="summary-icon"><ListTodo size={18} /></div><span className="summary-label">Total tasks</span><strong>{counts.all}</strong><span className="summary-note">in your workspace</span></div>
            <div className="summary-item summary-pending"><div className="summary-icon"><Clock3 size={18} /></div><span className="summary-label">Pending</span><strong>{counts.todo}</strong><span className="summary-note">waiting to begin</span></div>
            <div className="summary-item summary-progress"><div className="summary-icon"><LoaderCircle size={18} /></div><span className="summary-label">In progress</span><strong>{counts['in-progress']}</strong><span className="summary-note">moving forward</span></div>
            <div className="summary-item summary-done"><div className="summary-icon"><CheckCheck size={18} /></div><span className="summary-label">Completed</span><strong>{counts.done}</strong><span className="summary-note">finished tasks</span></div>
          </section>

          <section className="task-section">
            <div className="section-heading">
              <div><h2>{activeView === 'all' ? 'Your tasks' : currentView?.label}</h2><p>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} to keep track of</p></div>
              <button className="subtle-button" type="button" onClick={openNewTask}><Plus size={16} /> Add task</button>
            </div>

            <div className="task-toolbar">
              <div className="toolbar-actions">
                <label className="search-box"><Search size={16} /><input aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              </div>
            </div>

            <div className="task-list" aria-busy={isLoading}>
              {isLoading ? (
                <div className="task-skeleton-grid" role="status" aria-label="Loading tasks">
                  {[0, 1, 2].map((item) => (
                    <div className="task-skeleton" aria-hidden="true" key={item}>
                      <div className="skeleton-heading"><span /><span /></div>
                      <span className="skeleton-description" />
                      <span className="skeleton-date" />
                      <span className="skeleton-actions" />
                    </div>
                  ))}
                  <span className="visually-hidden">Loading tasks</span>
                </div>
              ) : loadError ? (
                <div className="task-load-error" role="alert">
                  <span className="load-error-icon"><CircleAlert size={19} /></span>
                  <div className="load-error-copy"><strong>Tasks could not be loaded</strong><p>{loadError}</p></div>
                  <button className="subtle-button" type="button" onClick={retryLoad}>Try again</button>
                </div>
              ) : filteredTasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <div className="task-card-main">
                    <div className="task-card-heading">
                      <h3 className="task-card-title">{task.title}</h3>
                      <span className={`status-badge status-${task.status === 'todo' ? 'pending' : task.status}`}>
                        {statusLabels[task.status] ?? 'Pending'}
                      </span>
                    </div>
                    <p className="task-card-description">{task.description || 'No description provided.'}</p>
                    <div className="task-card-created"><User size={14} /><span>{task.assignee ? `Assigned to ${task.assignee.name || `@${task.assignee.username}`}` : 'Unassigned'}</span></div>
                    <div className="task-card-created"><CalendarDays size={14} /><span>Created {formatCreatedDate(task.createdAt)}</span></div>
                  </div>
                  <div className="task-card-actions">
                    <button className="task-action-button" type="button" aria-label={`View ${task.title}`} onClick={() => openViewTask(task)}><Eye size={15} /><span>View</span></button>
                    <button className="task-action-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => openEditTask(task)}><Pencil size={15} /><span>Edit</span></button>
                    <button className="task-action-button task-delete-button" type="button" aria-label={`Delete ${task.title}`} onClick={() => requestTaskDelete(task)}><Trash2 size={15} /><span>Delete</span></button>
                  </div>
                </article>
              ))}
              {!isLoading && !loadError && filteredTasks.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon"><ClipboardList size={22} /></span>
                  <h3>{search ? 'No matching tasks' : 'Nothing on the list'}</h3>
                  <p>{search ? 'Try another search or clear the search field.' : 'A fresh start. Add a task whenever you’re ready.'}</p>
                  {!search && <button className="subtle-button" type="button" onClick={openNewTask}><Plus size={16} /> Create a task</button>}
                </div>
              )}
            </div>
          </section>
            </>
          )}
          <footer className="page-footer"><span>One thing at a time.</span><span className="footer-mark"><Check size={12} strokeWidth={3} /></span></footer>
        </div>
      </main>

      {isFormOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <header className="modal-header"><div><p className="eyebrow">MAKE IT HAPPEN</p><h2 id="modal-title">{editingTask ? 'Edit task' : 'Create a task'}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setIsFormOpen(false)}><X size={19} /></button></header>
            <TaskForm
              canAssign={isAdmin}
              errorMessage={formError}
              initialTask={editingTask}
              isSaving={isSaving}
              onCancel={() => setIsFormOpen(false)}
              onSubmit={saveTask}
              teamUsers={teamUsers}
            />
          </section>
        </div>
      )}

      {taskToView && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTaskToView(null) }}>
          <section className="task-modal view-task-modal" role="dialog" aria-modal="true" aria-labelledby="view-dialog-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">TASK DETAILS</p>
                <h2 id="view-dialog-title">View task</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setTaskToView(null)}><X size={19} /></button>
            </header>
            <div className="task-view-details">
              <div className="task-view-field">
                <span className="task-view-label">Title</span>
                <p className="task-view-value task-view-title">{taskToView.title}</p>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Description</span>
                <p className="task-view-value">{taskToView.description || 'No description provided.'}</p>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Status</span>
                <span className={`status-badge status-${taskToView.status === 'todo' ? 'pending' : taskToView.status}`}>
                  {statusLabels[taskToView.status] ?? 'Pending'}
                </span>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Assignee</span>
                <p className="task-view-value">
                  {taskToView.assignee
                    ? (taskToView.assignee.name
                        ? `${taskToView.assignee.name} (@${taskToView.assignee.username})`
                        : `@${taskToView.assignee.username}`)
                    : 'Unassigned'}
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="primary-button" type="button" onClick={() => setTaskToView(null)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {taskToDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setTaskToDelete(null) }}>
          <section className="task-modal delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
            <header className="modal-header">
              <div>
                <p className="eyebrow">CONFIRM ACTION</p>
                <h2 id="delete-dialog-title">Delete this task?</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" disabled={isDeleting} onClick={() => setTaskToDelete(null)}><X size={19} /></button>
            </header>
            <p className="delete-confirm-copy" id="delete-dialog-description">
              <strong>{taskToDelete.title}</strong> will be permanently removed.
            </p>
            {deleteError && <p className="api-error delete-dialog-error" role="alert">{deleteError}</p>}
            <div className="modal-actions">
              <button className="cancel-button" type="button" disabled={isDeleting} onClick={() => setTaskToDelete(null)}>Cancel</button>
              <button className="primary-button confirm-delete-button" type="button" disabled={isDeleting} onClick={confirmTaskDelete}>
                <Trash2 size={15} />{isDeleting ? 'Deleting...' : 'Delete task'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
