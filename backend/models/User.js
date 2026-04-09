import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


const userSchema = new mongoose.Schema({
     
  name: {
    type: String,                                   
    required: true,       
    trim: true                                   
  },
  

  email: {
    type: String,                                    
    required: true,          
    unique: true,                                 
    lowercase: true,                                 
    trim: true,                                    
  
  },
  
  
  password: {
    type: String,                                    
    required: true,      
    select: false      // Never send password in API response
  },
  

  phone: {
    type: String,                                    
    required: true,
    trim: true  
  },
  
  
  role: {
    type: String,                                    
    enum: ['user', 'responder', 'admin'],            
    default: 'user'                
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

  // for responders active status
  isAvailable: {
    type: Boolean,         
    default: false       //  (off duty)
  },

  responseHistory: [{
    emergencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Emergency',
    },
    responseTime: Number,   // in seconds
    feedback: Number,       // 1-5 rating
  }],
  
  // FOR RESPONDERS: Current location 
  location: {
    type: {
      type: String,             
      enum: ['Point']
    
    },
    coordinates: {
      type: [Number],             //  [longitude, latitude]
      default: undefined             
    }
  },
  
}, {
  timestamps: true     // Automatically add createdAt and updatedAt fields
});

// encrypt psw
userSchema.pre('save', async function() {
  // Only encrypt if psw is new or
  if (!this.isModified('password')) 
    return ;
  // random data added to psw before hashing
  const salt = await bcrypt.genSalt(10);
  
  // Hash psw
  this.password = await bcrypt.hash(this.password, salt);
 
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


userSchema.index({ location: '2dsphere' }, { sparse: true });




// Export the model so other files can use it
export default mongoose.model("User",userSchema);
