#  Sahayog - Emergency Response System

Real-time emergency coordination platform built with MERN stack.

##  Team Members

- **Shweta Neupane** 
- **Akshyata Khanal** 
- **Nancy Rai** 


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

frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── api/
│   │   ├── axios.js           # Axios instance with interceptors
│   │   ├── auth.js            # Auth API calls
│   │   ├── emergency.js       # Emergency API calls
│   │   ├── responder.js       # Responder API calls
│   │   └── user.js            # User API calls
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.jsx
│   │   │   ├── RegisterForm.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   │
│   │   ├── emergency/
│   │   │   ├── EmergencyForm.jsx
│   │   │   ├── EmergencyList.jsx
│   │   │   ├── EmergencyCard.jsx
│   │   │   └── EmergencyDetails.jsx
│   │   │
│   │   ├── responder/
│   │   │   ├── NearbyEmergencies.jsx
│   │   │   ├── MyAssignments.jsx
│   │   │   ├── ResponseActions.jsx
│   │   │   └── AvailabilityToggle.jsx
│   │   │
│   │   ├── map/
│   │   │   ├── MapView.jsx
│   │   │   ├── EmergencyMarker.jsx
│   │   │   ├── LocationPicker.jsx
│   │   │   └── RouteDisplay.jsx  # For A* route later
│   │   │
│   │   ├── admin/
│   │   │   ├── UserList.jsx
│   │   │   ├── EmergencyManagement.jsx
│   │   │   └── UserDetails.jsx
│   │   │
│   │   ├── common/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── ErrorMessage.jsx
│   │   │
│   │   └── layout/
│   │       ├── MainLayout.jsx
│   │       ├── DashboardLayout.jsx
│   │       └── AuthLayout.jsx
│   │
│   ├── context/
│   │   ├── AuthContext.jsx      # User auth state
│   │   ├── SocketContext.jsx    # Socket.io connection
│   │   └── LocationContext.jsx  # Geolocation handling
│   │
│   ├── hooks/
│   │   ├── useAuth.js           # Custom auth hook
│   │   ├── useSocket.js         # Socket.io hook
│   │   ├── useGeolocation.js    # Browser geolocation
│   │   └── useEmergencies.js    # Fetch emergencies logic
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   │
│   │   ├── user/
│   │   │   ├── UserDashboard.jsx
│   │   │   ├── CreateEmergency.jsx
│   │   │   ├── MyEmergencies.jsx
│   │   │   └── Profile.jsx
│   │   │
│   │   ├── responder/
│   │   │   ├── ResponderDashboard.jsx
│   │   │   ├── NearbyPage.jsx
│   │   │   └── AssignmentsPage.jsx
│   │   │
│   │   ├── admin/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   └── EmergenciesPage.jsx
│   │   │
│   │   └── NotFound.jsx
│   │
│   ├── utils/
│   │   ├── constants.js         # Emergency types, status enum
│   │   ├── helpers.js           # Date formatting, distance calc
│   │   └── validators.js        # Form validation
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css                # Minimal reset only
│
├── .env
├── .gitignore
├── package.json
├── vite.config.js
└── README.md