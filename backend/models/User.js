// Import required libraries
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
     // USER'S FULL NAME
  name: {
    type: String,                                   
    required: [true, 'Name is required'],          
    trim: true,                                    
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  
  // USER'S EMAIL ADDRESS
  email: {
    type: String,                                    
    required: [true, 'Email is required'],           
    unique: true,                                 
    lowercase: true,                                 
    trim: true,                                    
    match: [                                        
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  
  // USER'S PASSWORD (will be encrypted before saving)
  password: {
    type: String,                                    
    required: [true, 'Password is required'],       
    minlength: [6, 'Password must be at least 6 characters'],
    select: false                                    // Never send password in API response
  },
  
  // USER'S PHONE NUMBER
  phone: {
    type: String,                                    
    required: [true, 'Phone number is required'],    
    match: [                                      
      /^[0-9]{10}$/,
      'Please enter a valid 10-digit phone number'
    ]
  },
  
  // USER'S ROLE IN THE SYSTEM
  role: {
    type: String,                                    
    enum: ['user', 'responder', 'admin'],            
    default: 'user'                                  // If not specified, make them a regular user
  },
  
  skills: [{
  type: String,
  enum: [
    'medical',      
    'fire',           
    'security',     
    'general'       
  ]
}],

  // FOR RESPONDERS: Are they currently available to respond to emergencies?
  isAvailable: {
    type: Boolean,                                   // Must be true or false
    default: false                                   // Start as unavailable (off duty)
  },
  
  // FOR RESPONDERS: Current location (to find nearest one)
  location: {
    type: {
      type: String,                                  // Must be 'Point' for MongoDB
      enum: ['Point']
    },
    coordinates: {
      type: [Number],                                // Array of two numbers [longitude, latitude]
      default: undefined                             // Optional field
    }
  },
  
  // TIMESTAMP: When was this user account created?
  createdAt: {
    type: Date,                                      // Must be a date
    default: Date.now                                // Automatically set to current time
  }
}, {
  timestamps: true                                   // Automatically add createdAt and updatedAt fields
});

// encrypt psw
userSchema.pre('save', async function(next) {
  // Only encrypt if password is new or changed (not every time we update user)
  if (!this.isModified('password')) {
    return next();
  }
  
  // Generate a salt (random data added to password before hashing)
  const salt = await bcrypt.genSalt(10);
  
  // Hash the password with the salt
  this.password = await bcrypt.hash(this.password, salt);
  
  next(); // Continue with saving
});

// check if entered psw matches stored
userSchema.methods.comparePassword = async function(enteredPassword) {
  // bcrypt compares the plain text password with encrypted one
  return await bcrypt.compare(enteredPassword, this.password);
};


// generate auth token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id },                    // Payload: user's database ID
    process.env.JWT_SECRET,              // Secret key (from .env file)
    { expiresIn: '30d' }                 // Token valid for 30 days
  );
};


userSchema.index({ location: '2dsphere' });


userSchema.index({ email: 1 });

// Export the model so other files can use it
module.exports = mongoose.model('User', userSchema);