import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [emergencies, setEmergencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [emergencyType, setEmergencyType] = useState('medical');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);

  // Fetch emergency history
  useEffect(() => {
    fetchEmergencies();
    getLocation();
  }, []);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }),
        (err) => console.log('Location error:', err)
      );
    }
  };

  const fetchEmergencies = async () => {
    try {
      const res = await API.get('/emergency/my');
      setEmergencies(res.data.data || []);
    } catch (err) {
      console.log('Could not fetch emergencies');
    }
  };

  const handleReportEmergency = async (e) => {
    e.preventDefault();
    if (!location) {
      setMessage('❌ Could not get your location. Please allow location access.');
      return;
    }
    setLoading(true);
    try {
      await API.post('/emergency', {
        type: emergencyType,
        description,
        location: {
          type: 'Point',
          coordinates: [location.lng, location.lat]
        }
      });
      setMessage('✅ Emergency reported! Help is on the way!');
      setShowForm(false);
      setDescription('');
      fetchEmergencies();
    } catch (err) {
      setMessage('❌ Failed to report emergency. Try again.');
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    if (status === 'resolved') return 'bg-green-100 text-green-800';
    if (status === 'assigned') return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-red-600 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚨</span>
          <span className="text-xl font-bold">Sahayog</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">👤 {user?.name || 'User'}</span>
          <button
            onClick={logout}
            className="bg-white text-red-600 px-4 py-1 rounded-full text-sm font-semibold hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome, {user?.name?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {location
              ? '📍 Location detected — you can report emergencies'
              : '⏳ Getting your location...'}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-4 p-4 rounded-lg bg-white border shadow-sm text-center font-medium">
            {message}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <p className="font-bold text-gray-800 text-lg">{user?.name}</p>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <p className="text-gray-500 text-sm">{user?.phone}</p>
          </div>
          <div className="ml-auto">
            <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold">
              ● Active
            </span>
          </div>
        </div>

        {/* Big Emergency Button */}
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setMessage(''); }}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-xl font-bold py-6 rounded-2xl shadow-lg mb-6 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <span className="text-3xl">🆘</span>
            REPORT EMERGENCY
          </button>
        )}

        {/* Emergency Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border-2 border-red-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              🚨 Report Emergency
            </h2>
            <form onSubmit={handleReportEmergency}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Type
                </label>
                <select
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="medical">🏥 Medical</option>
                  <option value="fire">🔥 Fire</option>
                  <option value="security">🚔 Security</option>
                  <option value="general">⚠️ General</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe the emergency..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : '🆘 Send Alert'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Emergency History */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            📋 Emergency History
          </h2>
          {emergencies.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">📭</p>
              <p>No emergencies reported yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emergencies.map((em) => (
                <div key={em._id} className="border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800 capitalize">
                      {em.type} Emergency
                    </p>
                    <p className="text-sm text-gray-500">{em.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(em.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(em.status)}`}>
                    {em.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;