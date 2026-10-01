import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required.'],
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters.'],
    maxlength: [32, 'Username cannot exceed 32 characters.'],
    match: [/^[a-z0-9_.]+$/, 'Username may only contain letters, numbers, dots, and underscores.'],
    unique: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required.'],
    trim: true,
    maxlength: [60, 'Name cannot exceed 60 characters.'],
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    trim: true,
    lowercase: true,
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'A valid email is required.'],
  },
  phone: {
    // Optional — used only for SMS notifications. Format is validated in the
    // controller; stored as entered (trimmed) so it can be shown in the UI.
    type: String,
    trim: true,
    default: null,
    maxlength: [20, 'Phone cannot exceed 20 characters.'],
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'member'],
      message: 'Role must be admin or member.',
    },
    default: 'member',
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required.'],
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User
