
  function App() {
  return (
    <div className="App">
      <header>
        <h1> Sahayog - Emergency Response System</h1>
        <p>Real-time emergency coordination platform</p>
      </header>
      
      <main>
        <div className="status-card">
          <h2>✅ System Status</h2>
          <p><strong>Frontend:</strong> Running Successfully</p>
          <p><strong>Backend API:</strong> http://localhost:5000</p>
          <p><strong>Database:</strong> MongoDB (Sahayog)</p>
        </div>

        <div className="info-card">
          <h3>📋 Project Structure </h3>
          <ul>
            <li>✓ Backend - Express.js Server</li>
            <li>✓ Frontend - React Application</li>
            <li>✓ Database - MongoDB</li>
            <li>✓ Real-time - Socket.io (configured)</li>
            <li>✓ Maps - Leaflet (installed)</li>
          </ul>
        </div>

        <div className="team-card">
          <h3>👥 Development Team</h3>
          <p>Shweta Neupane • Akshyata Khanal • Nancy Rai</p>
          <p><small>Patan Multiple Campus | 2026</small></p>
        </div>
      </main>
    </div>
  );
}

export default App;



