import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';  // ✅ use api service, not raw axios
import { useAuth } from '../context/AuthContext';  // ✅ use context

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();  // ✅ get login function from context

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await authAPI.login({ email, password });  // ✅ use authAPI

      // ✅ Save to context (which also saves to localStorage internally)
      login(res.data.user, res.data.token);

      // Redirect based on role
      const role = res.data.user.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'responder') navigate('/responder');
      else navigate('/dashboard');

    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);  // ✅ always stop loading, even if error
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-[#f0f2f5]">
      <div className="bg-white p-10 rounded-xl shadow-md w-[350px]">
        <h2 className="text-center text-[#e74c3c] mb-1 text-2xl font-bold">🚨 Sahayog</h2>
        <h3 className="text-center text-[#333] mb-5 text-lg font-semibold">Login</h3>

        {error && <p className="text-red-500 text-center mb-3 text-sm">{error}</p>}

        <form onSubmit={handleLogin}>
          <input
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className={`w-full py-3 bg-[#e74c3c] text-white border-none rounded-md text-base cursor-pointer transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;