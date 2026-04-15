const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  plan: { type: String, enum: ['basic', 'premium'], required: true },
  status: { type: String, enum: ['active', 'past_due', 'canceled', 'incomplete'], default: 'active' },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  amount: { type: Number, required: true }, // in cents
  currency: { type: String, default: 'usd' },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Index for efficient queries
SubscriptionSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);