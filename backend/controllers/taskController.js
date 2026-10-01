import Task from '../models/Task.js'
import User from '../models/User.js'
import { notifyTaskAssigned, notifyTaskUpdated } from '../services/emailService.js'
import { notifySmsTaskAssigned, notifySmsTaskUpdated } from '../services/smsService.js'
import { notifyWhatsappTaskAssigned, notifyWhatsappTaskUpdated } from '../services/whatsappService.js'

const OBJECT_ID_PATTERN = /^[\da-f]{24}$/i

// Accepts undefined (not provided), null/'' (unassigned) or a valid user id.
async function resolveAssignee(value) {
  if (value === undefined) return { value: undefined }
  if (value === null || value === '') return { value: null }
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    return { error: 'Invalid assignee.' }
  }
  const userExists = await User.exists({ _id: value })
  if (!userExists) return { error: 'The selected user does not exist.' }
  return { value }
}

export async function listTasks(request, response, next) {
  try {
    const tasks = await Task.find()
      .populate('assignee', 'username name')
      .sort({ createdAt: -1 })
      .lean()
    response.json(tasks)
  } catch (error) {
    next(error)
  }
}

export async function addTask(request, response, next) {
  try {
    const resolvedAssignee = await resolveAssignee(request.body?.assignee)
    if (resolvedAssignee.error) return response.status(400).json({ error: resolvedAssignee.error })

    const task = await Task.create({
      title: request.body?.title,
      description: request.body?.description,
      status: request.body?.status,
      assignee: resolvedAssignee.value,
    })
    const savedTask = await Task.findById(task._id).populate('assignee', 'username name').lean()
    // New task with an assignee → email + SMS + WhatsApp assignment notices
    // (all fire-and-forget; failures never affect the response).
    if (savedTask?.assignee?._id) {
      notifyTaskAssigned(savedTask, savedTask.assignee._id)
      notifySmsTaskAssigned(savedTask, savedTask.assignee._id)
      notifyWhatsappTaskAssigned(savedTask, savedTask.assignee._id)
    }
    response.status(201).json(savedTask)
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
}

export async function editTask(request, response, next) {
  const { id } = request.params
  const updates = request.body

  if (!/^[\da-f]{24}$/i.test(id)) {
    return response.status(400).json({ error: 'Invalid task ID.' })
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return response.status(400).json({ error: 'A task update object is required.' })
  }

  try {
    const task = await Task.findById(id)
    if (!task) return response.status(404).json({ error: 'Task not found.' })

    // Snapshot current values so we can report what actually changed.
    const previous = {
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      assignee: task.assignee ? String(task.assignee) : null,
    }

    let assigneeValue
    if (Object.hasOwn(updates, 'assignee')) {
      const resolvedAssignee = await resolveAssignee(updates.assignee)
      if (resolvedAssignee.error) return response.status(400).json({ error: resolvedAssignee.error })
      assigneeValue = resolvedAssignee.value ?? null
    }

    for (const field of ['title', 'description', 'status']) {
      if (Object.hasOwn(updates, field)) task[field] = updates[field]
    }
    if (Object.hasOwn(updates, 'assignee')) task.assignee = assigneeValue

    await task.save()
    await task.populate('assignee', 'username name')

    // Notify: a new assignee gets the assignment email/SMS; otherwise the
    // current assignee gets an update notice listing fields that changed.
    const nextAssignee = task.assignee ? String(task.assignee._id) : null
    const assigneeChanged = Object.hasOwn(updates, 'assignee') && nextAssignee !== previous.assignee
    if (assigneeChanged && nextAssignee) {
      notifyTaskAssigned(task, nextAssignee)
      notifySmsTaskAssigned(task, nextAssignee)
      notifyWhatsappTaskAssigned(task, nextAssignee)
    } else if (nextAssignee) {
      const changes = []
      if (Object.hasOwn(updates, 'title') && task.title !== previous.title) {
        changes.push({ field: 'title', from: previous.title, to: task.title })
      }
      if (Object.hasOwn(updates, 'description') && (task.description ?? '') !== previous.description) {
        changes.push({ field: 'description', from: previous.description || '(empty)', to: task.description || '(empty)' })
      }
      if (Object.hasOwn(updates, 'status') && task.status !== previous.status) {
        changes.push({ field: 'status', from: previous.status, to: task.status })
      }
      if (changes.length > 0) {
        notifyTaskUpdated(task, nextAssignee, changes)
        notifySmsTaskUpdated(task, nextAssignee, changes)
        notifyWhatsappTaskUpdated(task, nextAssignee, changes)
      }
    }

    response.json(task)
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
}

export async function removeTask(request, response, next) {
  const { id } = request.params
  if (!/^[\da-f]{24}$/i.test(id)) {
    return response.status(400).json({ error: 'Invalid task ID.' })
  }

  try {
    const task = await Task.findByIdAndDelete(id)
    if (!task) return response.status(404).json({ error: 'Task not found.' })
    response.json({ message: 'Task deleted successfully.' })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({ error: 'Invalid task ID.' })
    }
    next(error)
  }
}