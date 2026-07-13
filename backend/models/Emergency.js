import mongoose from 'mongoose';


const emergencySchema = new mongoose.Schema({
  reporterId: {
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
  reporterLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  address: {
    type: String,
    trim: true,
  },
  dispatchStatus: {
    type: String,
    enum: ['searching', 'offered', 'assigned', 'unavailable'],
    default: null
  },
  currentDispatchRadiusKm: {
    type: Number,
    enum: [5, 10, 15, 20],
  },
  assignedResponder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  requiredSkills: [{
    type: String,
    enum: ['medical', 'fire', 'security', 'general'],
    default: undefined
  }],
  
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
      enum: ['notified', 'accepted', 'declined', 'en_route', 'on_scene', 'completed'],
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

emergencySchema.index({ reporterLocation: '2dsphere' });
emergencySchema.index({ status: 1 });
emergencySchema.index({ createdAt: -1 });
emergencySchema.index({ reporterId: 1, status: 1 });

export default mongoose.model('Emergency', emergencySchema);