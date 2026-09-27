import Task from '../models/Task.js'

export async function listTasks(request, response, next) {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 }).lean()
    response.json(tasks)
  } catch (error) {
    next(error)
  }
}

export async function addTask(request, response, next) {
  try {
    const task = await Task.create({
      title: request.body?.title,
      description: request.body?.description,
      status: request.body?.status,
    })
    response.status(201).json(task)
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

    for (const field of ['title', 'description', 'status']) {
      if (Object.hasOwn(updates, field)) task[field] = updates[field]
    }

    await task.save()
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