import mongoose from 'mongoose'

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required.'],
    trim: true,
    minlength: [1, 'Task title cannot be empty.'],
    maxlength: [100, 'Task title cannot exceed 100 characters.'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters.'],
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'In Progress', 'Done'],
      message: 'Status must be Pending, In Progress, or Done.',
    },
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema)

export default Task