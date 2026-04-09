import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(' MongoDB Connected to Sahayog Database!');
  } catch (error) {
    console.error(' MongoDB connection failed:', error);
    process.exit(1);
  }
}

