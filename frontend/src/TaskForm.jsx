import { useState } from 'react'
import { Check } from 'lucide-react'

function TaskForm({ canAssign = false, errorMessage, initialTask, isSaving, onCancel, onSubmit, teamUsers = [] }) {
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [status, setStatus] = useState(initialTask?.apiStatus ?? 'Pending')
  const [assignee, setAssignee] = useState(initialTask?.assignee?._id ?? '')
  const [titleError, setTitleError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      setTitleError('Title is required.')
      return
    }

    setTitleError('')
    onSubmit({
      title: normalizedTitle,
      description: description.trim(),
      status,
      ...(canAssign ? { assignee: assignee || null } : {}),
    })
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      {errorMessage && <p className="api-error task-form-error" role="alert">{errorMessage}</p>}
      <label className="form-field" htmlFor="task-title">
        <span>Title</span>
        <input
          autoFocus
          aria-describedby={titleError ? 'task-title-error' : undefined}
          aria-invalid={Boolean(titleError)}
          aria-required="true"
          id="task-title"
          maxLength={100}
          onChange={(event) => {
            setTitle(event.target.value)
            if (event.target.value.trim()) setTitleError('')
          }}
          placeholder="What needs to get done?"
          value={title}
        />
        {titleError && <span className="field-error" id="task-title-error">{titleError}</span>}
      </label>

      <label className="form-field" htmlFor="task-description">
        <span>Description <small>Optional</small></span>
        <textarea
          id="task-description"
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add a few details"
          rows="3"
          value={description}
        />
      </label>

      <label className="form-field" htmlFor="task-status">
        <span>Status</span>
        <select id="task-status" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
      </label>

      {canAssign && (
        <label className="form-field" htmlFor="task-assignee">
          <span>Assignee <small>Optional</small></span>
          <select id="task-assignee" onChange={(event) => setAssignee(event.target.value)} value={assignee}>
            <option value="">Unassigned</option>
            {teamUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.name} (@{user.username})</option>
            ))}
          </select>
        </label>
      )}

      <div className="modal-actions">
        <button className="cancel-button" disabled={isSaving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={isSaving} type="submit">
          <Check size={17} />{isSaving ? 'Saving...' : initialTask ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  )
}

export default TaskForm