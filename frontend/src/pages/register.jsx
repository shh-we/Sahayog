import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';   // ✅ no raw axios

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'user',
    skills: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Handles all text inputs and select
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handles skill checkboxes — toggles skill in/out of array
  const handleSkillChange = (skill) => {
    const updatedSkills = formData.skills.includes(skill)
      ? formData.skills.filter(s => s !== skill)  // remove if already selected
      : [...formData.skills, skill];               // add if not selected
    setFormData({ ...formData, skills: updatedSkills });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.register(formData);  // ✅ use authAPI, not raw axios
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);  // always stop loading whether success or error
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#f0f2f5]">
      <div className="bg-white p-10 rounded-xl shadow-md w-[350px]">
        <h2 className="text-center text-[#e74c3c] mb-1 text-2xl font-bold">🚨 Sahayog</h2>
        <h3 className="text-center text-[#333] mb-5 text-lg font-semibold">Create Account</h3>

        {error && <p className="text-red-500 text-center mb-3 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-center mb-3 text-sm">{success}</p>}

        <form onSubmit={handleSubmit}>
          <input
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            type="text"
            name="phone"
            placeholder="Phone Number (10 digits)"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <select
            className="w-full px-3 py-3 mb-4 rounded-md border border-[#ddd] text-sm box-border"
            name="role"
            value={formData.role}
            onChange={handleChange}
          >
            <option value="user">Regular User</option>
            <option value="responder">Responder</option>
          </select>

          {formData.role === 'responder' && (
            <div className="bg-[#f8f8f8] p-3 rounded-md mb-4">
              <p className="font-bold mb-2 text-sm">Select Your Skills:</p>
              {['medical', 'fire', 'security', 'general'].map(skill => (
                <label key={skill} className="block mb-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.skills.includes(skill)}
                    onChange={() => handleSkillChange(skill)}
                  />
                  {' '}{skill.charAt(0).toUpperCase() + skill.slice(1)}
                </label>
              ))}
            </div>
          )}

          <button
            className={`w-full py-3 bg-[#e74c3c] text-white border-none rounded-md text-base cursor-pointer transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;