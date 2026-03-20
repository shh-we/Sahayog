# 🚨 Sahayog - Emergency Response System

Real-time emergency coordination platform built with MERN stack.

## 👥 Team Members

- **Shweta Neupane** (79010116)
- **Akshyata Khanal** (79010008)
- **Nancy Rai** (79010059)

**Institution:** Patan Multiple Campus  
**Program:** Bachelor's in Computer Science and Information Technology  
**Year:** 2026

---

## 📋 Project Overview

Sahayog is a web-based emergency response system that enables:
- ✅ Quick emergency reporting with automatic location detection
- ✅ Real-time responder assignment using proximity algorithms
- ✅ Live tracking of emergency responders
- ✅ Instant status updates via WebSocket communication

---

## 🛠️ Tech Stack

### Frontend
- **React.js** - User interface
- **Leaflet** - Interactive maps
- **Socket.io Client** - Real-time communication
- **Axios** - HTTP requests
- **React Router** - Navigation

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Socket.io** - WebSocket server
- **JWT** - Authentication
- **Bcrypt** - Password hashing

---

## 📁 Project Structure
```
Sahayog/
├── backend/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── utils/          # Utility functions
│   ├── .env            # Environment variables
│   └── server.js       # Entry point
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   ├── utils/      # Helper functions
│   │   ├── context/    # React context
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── .gitignore
└── README.md
```