const mongoose = require('mongoose');


const emergencySchema = new mongoose.Schema({
  
  // WHO REPORTED THIS EMERGENCY
  user: {
    type: mongoose.Schema.Types.ObjectId,           
    ref: 'User',                                    
    required: [true, 'Emergency must be linked to a user']
  },
  
  // WHAT TYPE OF EMERGENCY IS THIS?
  type: {
    type: String,                                   
    enum: ['Medical', 'Fire', 'Security', 'Other'], 
    required: [true, 'Emergency type is required']
  },
  
  // DESCRIPTION OF THE EMERGENCY
  description: {
    type: String,                                  
    trim: true,                                     
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // WHERE DID THIS EMERGENCY HAPPEN?
  location: {
    type: {
      type: String,                                
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],                               // [longitude, latitude]
      required: [true, 'Location coordinates are required']
    },
    address: {
      type: String,          //human readable address
      trim: true
    }
  },
  
  // CURRENT STATUS OF THIS EMERGENCY
  status: {
    type: String,                                
    enum: [
      'pending',      // Just reported
      'assigned',     // Responder assigned, not yet moving
      'in-progress',  // Responder on the way 
      'resolved',     // Emergency handled and closed
      'cancelled'     // User cancelled the emergency
    ],
    default: 'pending'                              // New emergencies start as pending
  },
  
  // WHO IS HANDLING THIS EMERGENCY?
  assignedResponder: {
    type: mongoose.Schema.Types.ObjectId,           
    ref: 'User',                                   
    default: null                                   
  },
  
  // WHEN WAS A RESPONDER ASSIGNED?
  assignedAt: {
    type: Date,                                     // Timestamp
    default: null                                   // Initially null
  },
  
  // WHEN WAS THIS EMERGENCY RESOLVED?
  resolvedAt: {
    type: Date,                                     // Timestamp
    default: null                                   // Initially null
  },
  
  // WHEN WAS THIS EMERGENCY REPORTED?
  createdAt: {
    type: Date,                                     // Timestamp
    default: Date.now                               // Automatically set to now
  },
  
  // WHEN WAS THIS EMERGENCY LAST UPDATED?
  updatedAt: {
    type: Date,                                     // Timestamp
    default: Date.now                               // Automatically set to now
  }
}, {
  timestamps: true                                  // Automatically manage createdAt and updatedAt
});


emergencySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});


emergencySchema.index({ location: '2dsphere' });


emergencySchema.index({ status: 1 });


emergencySchema.index({ createdAt: -1 });


emergencySchema.index({ user: 1, status: 1 });

// Export the model so other files can use it
module.exports = mongoose.model('Emergency', emergencySchema);