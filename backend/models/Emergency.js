import mongoose from 'mongoose';


const emergencySchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['fire', 'medical', 'security', 'natural_disaster', 'other'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  aiClassification: {
    category: String,
    severity: {
      type: Number,
      min: 1,
      max: 5,
    },
    requiredSkills: [String],
    confidence: Number,
  },
  status: {
    type: String,
    enum: ['active', 'assigned', 'in_progress', 'resolved', 'cancelled'],
    default: 'active',
  },
  responders: [{
    userId: {
      type:mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['notified', 'en_route', 'on_scene', 'completed'],
      default: 'notified',
    },
    notifiedAt: Date,
    respondedAt: Date,
    arrivedAt: Date,
    completedAt: Date,
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
  }],
  resolvedAt: Date,

}, { timestamps: true });

emergencySchema.index({ location: '2dsphere' });
emergencySchema.index({ status: 1 });
emergencySchema.index({ createdAt: -1 });
emergencySchema.index({ createdBy: 1, status: 1 });

export default mongoose.model('Emergency', emergencySchema);