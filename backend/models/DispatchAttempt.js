import mongoose from 'mongoose';

const dispatchAttemptSchema = new mongoose.Schema({
  emergencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Emergency',
    required: true,
    index: true
  },
  responderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  offeredAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  respondedAt: {
    type: Date,
    default: null
  },
  etaSeconds: {
    type: Number,
    default: null
  }
}, { timestamps: true });

// Compound index for the worker sweep: find pending + expired attempts efficiently
dispatchAttemptSchema.index({ status: 1, expiresAt: 1 });

// Compound index for checking existing pending attempts per emergency
dispatchAttemptSchema.index({ emergencyId: 1, status: 1 });

export default mongoose.model('DispatchAttempt', dispatchAttemptSchema);
