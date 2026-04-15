const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: false },
  role: { type: String, enum: ['owner', 'admin', 'manager', 'user'], default: 'user' },
  plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  isActive: { type: Boolean, default: true },
  resumeScore: { type: Number, default: 0 },
  checklistProgress: { type: Number, default: 0 },
  lastLogin: { type: Date },
  profile: {
    avatar: String,
    bio: String,
    skills: [String],
    experience: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
UserSchema.index({ organizationId: 1, email: 1 });
UserSchema.index({ organizationId: 1, role: 1 });

module.exports = mongoose.model('User', UserSchema);
