const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, required: true, unique: true }, // subdomain for SaaS
  description: String,
  logo: String,
  website: String,
  industry: String,
  size: { type: String, enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
  plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['trial', 'active', 'past_due', 'canceled'], default: 'trial' },
  trialEndsAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days trial
  settings: {
    allowPublicRegistration: { type: Boolean, default: true },
    maxUsers: { type: Number, default: 10 }, // Free plan limit
    features: {
      analytics: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false }
    }
  },
  stats: {
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    totalPlacements: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Domain uniqueness is handled by unique: true in schema

module.exports = mongoose.model('Organization', OrganizationSchema);