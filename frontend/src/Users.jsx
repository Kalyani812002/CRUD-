import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CircleAlert,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react'
import { apiRequest } from './api.js'

const USERNAME_PATTERN = /^[a-z0-9_.]{3,32}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/

function normalizeUser(user) {
  return { ...user, id: user._id ?? user.id }
}

function formatDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function UserForm({ errorMessage, initialUser, isSaving, onCancel, onSubmit }) {
  const [name, setName] = useState(initialUser?.name ?? '')
  const [username, setUsername] = useState(initialUser?.username ?? '')
  const [email, setEmail] = useState(initialUser?.email ?? '')
  const [phone, setPhone] = useState(initialUser?.phone ?? '')
  const [role, setRole] = useState(initialUser?.role ?? 'member')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    const nextName = name.trim()
    const nextUsername = username.trim().toLowerCase()
    const nextEmail = email.trim().toLowerCase()
    const nextPhone = phone.trim()
    const nextNameError = nextName ? '' : 'Name is required.'
    const nextUsernameError = USERNAME_PATTERN.test(nextUsername)
      ? ''
      : 'Use 3–32 letters, numbers, dots, or underscores.'
    const nextEmailError = EMAIL_PATTERN.test(nextEmail) ? '' : 'Enter a valid email address.'
    const nextPhoneError = nextPhone && !PHONE_PATTERN.test(nextPhone)
      ? 'Enter a valid phone number (7–20 digits, optional + country code).'
      : ''
    const nextPasswordError = (!initialUser || password) && password.length < 6
      ? 'Password must be at least 6 characters.'
      : ''

    setNameError(nextNameError)
    setUsernameError(nextUsernameError)
    setEmailError(nextEmailError)
    setPhoneError(nextPhoneError)
    setPasswordError(nextPasswordError)
    if (nextNameError || nextUsernameError || nextEmailError || nextPhoneError || nextPasswordError) return

    onSubmit({
      name: nextName,
      username: nextUsername,
      email: nextEmail,
      phone: nextPhone,
      role,
      ...(password ? { password } : {}),
    })
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      {errorMessage && <p className="api-error task-form-error" role="alert">{errorMessage}</p>}

      <label className="form-field" htmlFor="user-name">
        <span>Full name</span>
        <input
          autoFocus
          aria-describedby={nameError ? 'user-name-error' : undefined}
          aria-invalid={Boolean(nameError)}
          aria-required="true"
          id="user-name"
          maxLength={60}
          onChange={(event) => {
            setName(event.target.value)
            if (event.target.value.trim()) setNameError('')
          }}
          placeholder="Jane Doe"
          value={name}
        />
        {nameError && <span className="field-error" id="user-name-error">{nameError}</span>}
      </label>

      <label className="form-field" htmlFor="user-username">
        <span>Username</span>
        <input
          aria-describedby={usernameError ? 'user-username-error' : undefined}
          aria-invalid={Boolean(usernameError)}
          aria-required="true"
          autoComplete="username"
          id="user-username"
          maxLength={32}
          onChange={(event) => {
            setUsername(event.target.value)
            if (USERNAME_PATTERN.test(event.target.value.trim().toLowerCase())) setUsernameError('')
          }}
          placeholder="jane.doe"
          value={username}
        />
        {usernameError && <span className="field-error" id="user-username-error">{usernameError}</span>}
      </label>

      <label className="form-field" htmlFor="user-email">
        <span>Email</span>
        <input
          aria-describedby={emailError ? 'user-email-error' : undefined}
          aria-invalid={Boolean(emailError)}
          aria-required="true"
          autoComplete="email"
          id="user-email"
          maxLength={120}
          onChange={(event) => {
            setEmail(event.target.value)
            if (EMAIL_PATTERN.test(event.target.value.trim().toLowerCase())) setEmailError('')
          }}
          placeholder="jane@company.com"
          type="email"
          value={email}
        />
        {emailError && <span className="field-error" id="user-email-error">{emailError}</span>}
      </label>

      <label className="form-field" htmlFor="user-phone">
        <span>Phone <small>Optional · for SMS notifications</small></span>
        <input
          aria-describedby={phoneError ? 'user-phone-error' : undefined}
          aria-invalid={Boolean(phoneError)}
          autoComplete="tel"
          id="user-phone"
          maxLength={20}
          onChange={(event) => {
            setPhone(event.target.value)
            if (!event.target.value.trim() || PHONE_PATTERN.test(event.target.value.trim())) setPhoneError('')
          }}
          placeholder="+1 555 010 1234"
          type="tel"
          value={phone}
        />
        {phoneError && <span className="field-error" id="user-phone-error">{phoneError}</span>}
      </label>

      <label className="form-field" htmlFor="user-role">
        <span>Role</span>
        <select id="user-role" onChange={(event) => setRole(event.target.value)} value={role}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>

      <label className="form-field" htmlFor="user-password">
        <span>
          {initialUser ? 'New password' : 'Password'}
          {initialUser && <small> Leave blank to keep current</small>}
        </span>
        <input
          aria-describedby={passwordError ? 'user-password-error' : undefined}
          aria-invalid={Boolean(passwordError)}
          aria-required={initialUser ? undefined : 'true'}
          autoComplete="new-password"
          id="user-password"
          maxLength={128}
          onChange={(event) => {
            setPassword(event.target.value)
            if (event.target.value.length >= 6 || (initialUser && !event.target.value)) setPasswordError('')
          }}
          placeholder={initialUser ? 'Enter a new password' : 'At least 6 characters'}
          type="password"
          value={password}
        />
        {passwordError && <span className="field-error" id="user-password-error">{passwordError}</span>}
      </label>

      <div className="modal-actions">
        <button className="cancel-button" disabled={isSaving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={isSaving} type="submit">
          <Plus size={17} />{isSaving ? 'Saving...' : initialUser ? 'Save changes' : 'Create user'}
        </button>
      </div>
    </form>
  )
}

function Users() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userToView, setUserToView] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  async function fetchUsers() {
    const result = await apiRequest('/api/users')
    return (Array.isArray(result) ? result : []).map(normalizeUser)
  }

  function loadUsers() {
    setIsLoading(true)
    setLoadError('')
    fetchUsers()
      .then(setUsers)
      .catch((error) => setLoadError(error.message))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    let isActive = true
    fetchUsers()
      .then((result) => { if (isActive) setUsers(result) })
      .catch((error) => { if (isActive) setLoadError(error.message) })
      .finally(() => { if (isActive) setIsLoading(false) })
    return () => {
      isActive = false
    }
  }, [])

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.name} ${user.username} ${user.email} ${user.phone ?? ''} ${user.role}`.toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
  })

  function openAddUser() {
    setEditingUser(null)
    setFormError('')
    setSuccessMessage('')
    setIsFormOpen(true)
  }

  function openEditUser(user) {
    setEditingUser(user)
    setFormError('')
    setSuccessMessage('')
    setIsFormOpen(true)
  }

  function openViewUser(user) {
    setUserToView(user)
    setSuccessMessage('')
  }

  function requestUserDelete(user) {
    setUserToDelete(user)
    setDeleteError('')
    setSuccessMessage('')
  }

  async function saveUser(fields) {
    setIsSaving(true)
    setFormError('')
    try {
      const isEditing = Boolean(editingUser)
      await apiRequest(
        isEditing ? `/api/users/${encodeURIComponent(editingUser.id)}` : '/api/users',
        { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(fields) },
      )
      setSuccessMessage(isEditing ? 'User updated successfully.' : 'User created successfully.')
      setIsFormOpen(false)
      setEditingUser(null)
      await loadUsers()
    } catch (error) {
      setSuccessMessage('')
      setFormError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmUserDelete() {
    if (!userToDelete) return

    setIsDeleting(true)
    setDeleteError('')
    try {
      await apiRequest(`/api/users/${encodeURIComponent(userToDelete.id)}`, { method: 'DELETE' })
      setSuccessMessage(`${userToDelete.name} was deleted successfully.`)
      setUserToDelete(null)
      await loadUsers()
    } catch (error) {
      setDeleteError(error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {successMessage && <p className="api-success" role="status">{successMessage}</p>}

      <section className="welcome-row">
        <div>
          <p className="eyebrow">WHO HAS ACCESS</p>
          <h1>Manage users.</h1>
          <p className="welcome-subtitle">Add teammates, adjust roles, or remove accounts from this workspace.</p>
        </div>
        <button className="primary-button" type="button" onClick={openAddUser}>
          <Plus size={18} strokeWidth={2.3} /> <span>Add user</span>
        </button>
      </section>

      <section className="task-section">
        <div className="section-heading">
          <div>
            <h2>Team members</h2>
            <p>{filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'} in this workspace</p>
          </div>
          <button className="subtle-button" type="button" onClick={openAddUser}><Plus size={16} /> Add user</button>
        </div>

        <div className="task-toolbar">
          <div className="toolbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input aria-label="Search users" placeholder="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="task-list" aria-busy={isLoading}>
          {isLoading ? (
            <div className="task-skeleton-grid" role="status" aria-label="Loading users">
              {[0, 1, 2].map((item) => (
                <div className="task-skeleton" aria-hidden="true" key={item}>
                  <div className="skeleton-heading"><span /><span /></div>
                  <span className="skeleton-description" />
                  <span className="skeleton-date" />
                  <span className="skeleton-actions" />
                </div>
              ))}
              <span className="visually-hidden">Loading users</span>
            </div>
          ) : loadError ? (
            <div className="task-load-error" role="alert">
              <span className="load-error-icon"><CircleAlert size={19} /></span>
              <div className="load-error-copy"><strong>Users could not be loaded</strong><p>{loadError}</p></div>
              <button className="subtle-button" type="button" onClick={loadUsers}>Try again</button>
            </div>
          ) : filteredUsers.map((user) => (
            <article className="task-card" key={user.id}>
              <div className="task-card-main">
                <div className="task-card-heading">
                  <h3 className="task-card-title">{user.name}</h3>
                  <span className={`status-badge ${user.role === 'admin' ? 'status-done' : 'status-in-progress'}`}>
                    {user.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                </div>
                <p className="task-card-description">{user.email} · @{user.username}</p>
                <div className="task-card-created"><CalendarDays size={14} /><span>Joined {formatDate(user.createdAt)}</span></div>
              </div>
              <div className="task-card-actions">
                <button className="task-action-button" type="button" aria-label={`View ${user.name}`} onClick={() => openViewUser(user)}><Eye size={15} /><span>View</span></button>
                <button className="task-action-button" type="button" aria-label={`Edit ${user.name}`} onClick={() => openEditUser(user)}><Pencil size={15} /><span>Edit</span></button>
                <button className="task-action-button task-delete-button" type="button" aria-label={`Delete ${user.name}`} onClick={() => requestUserDelete(user)}><Trash2 size={15} /><span>Delete</span></button>
              </div>
            </article>
          ))}
          {!isLoading && !loadError && filteredUsers.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><UsersIcon size={22} /></span>
              <h3>{search ? 'No matching members' : 'No users yet'}</h3>
              <p>{search ? 'Try another search or clear the search field.' : 'Add the first user to this workspace.'}</p>
              {!search && <button className="subtle-button" type="button" onClick={openAddUser}><Plus size={16} /> Add a user</button>}
            </div>
          )}
        </div>
      </section>

      {isFormOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">TEAM ACCESS</p>
                <h2 id="user-modal-title">{editingUser ? 'Edit user' : 'Add a new user'}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setIsFormOpen(false)}><X size={19} /></button>
            </header>
            <UserForm
              errorMessage={formError}
              initialUser={editingUser}
              isSaving={isSaving}
              onCancel={() => setIsFormOpen(false)}
              onSubmit={saveUser}
            />
          </section>
        </div>
      )}

      {userToView && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setUserToView(null) }}>
          <section className="task-modal view-task-modal" role="dialog" aria-modal="true" aria-labelledby="view-user-dialog-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">USER DETAILS</p>
                <h2 id="view-user-dialog-title">View user</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setUserToView(null)}><X size={19} /></button>
            </header>
            <div className="task-view-details">
              <div className="task-view-field">
                <span className="task-view-label">Name</span>
                <p className="task-view-value task-view-title">{userToView.name}</p>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Username</span>
                <p className="task-view-value">@{userToView.username}</p>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Email</span>
                <p className="task-view-value">{userToView.email}</p>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Phone</span>
                <p className="task-view-value">{userToView.phone || 'No phone number'}</p>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Role</span>
                <span className={`status-badge ${userToView.role === 'admin' ? 'status-done' : 'status-in-progress'}`}>
                  {userToView.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
              <div className="task-view-field">
                <span className="task-view-label">Joined</span>
                <p className="task-view-value">{formatDate(userToView.createdAt)}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="primary-button" type="button" onClick={() => setUserToView(null)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {userToDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setUserToDelete(null) }}>
          <section className="task-modal delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-dialog-title" aria-describedby="delete-user-dialog-description">
            <header className="modal-header">
              <div>
                <p className="eyebrow">CONFIRM ACTION</p>
                <h2 id="delete-user-dialog-title">Delete this user?</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" disabled={isDeleting} onClick={() => setUserToDelete(null)}><X size={19} /></button>
            </header>
            <p className="delete-confirm-copy" id="delete-user-dialog-description">
              <strong>{userToDelete.name}</strong> will be permanently removed from this workspace.
            </p>
            {deleteError && <p className="api-error delete-dialog-error" role="alert">{deleteError}</p>}
            <div className="modal-actions">
              <button className="cancel-button" type="button" disabled={isDeleting} onClick={() => setUserToDelete(null)}>Cancel</button>
              <button className="primary-button confirm-delete-button" type="button" disabled={isDeleting} onClick={confirmUserDelete}>
                <Trash2 size={15} />{isDeleting ? 'Deleting...' : 'Delete user'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default Users

