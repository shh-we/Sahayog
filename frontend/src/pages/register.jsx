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
    <div style={styles.container}>
      <div style={styles.box}>
        <h2 style={styles.title}>🚨 Sahayog</h2>
        <h3 style={styles.subtitle}>Create Account</h3>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            style={styles.input}
            type="text"
            name="phone"
            placeholder="Phone Number (10 digits)"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <select
            style={styles.input}
            name="role"
            value={formData.role}
            onChange={handleChange}
          >
            <option value="user">Regular User</option>
            <option value="responder">Responder</option>
          </select>

          {/* Only show skills if role is responder */}
          {formData.role === 'responder' && (
            <div style={styles.skillsBox}>
              <p style={styles.skillsTitle}>Select Your Skills:</p>
              {['medical', 'fire', 'security', 'general'].map(skill => (
                <label key={skill} style={styles.skillLabel}>
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
            style={loading ? {...styles.button, opacity: 0.7} : styles.button}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p style={styles.link}>
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', backgroundColor:'#f0f2f5' },
  box: { backgroundColor:'white', padding:'40px', borderRadius:'10px', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', width:'350px' },
  title: { textAlign:'center', color:'#e74c3c', marginBottom:'5px' },
  subtitle: { textAlign:'center', color:'#333', marginBottom:'20px' },
  input: { width:'100%', padding:'12px', marginBottom:'15px', borderRadius:'6px', border:'1px solid #ddd', fontSize:'14px', boxSizing:'border-box' },
  button: { width:'100%', padding:'12px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'6px', fontSize:'16px', cursor:'pointer' },
  error: { color:'red', textAlign:'center', marginBottom:'10px' },
  success: { color:'green', textAlign:'center', marginBottom:'10px' },
  link: { textAlign:'center', marginTop:'15px', fontSize:'14px' },
  skillsBox: { backgroundColor:'#f8f8f8', padding:'10px', borderRadius:'6px', marginBottom:'15px' },
  skillsTitle: { fontWeight:'bold', marginBottom:'8px', fontSize:'14px' },
  skillLabel: { display:'block', marginBottom:'5px', fontSize:'14px', cursor:'pointer' }
};

export default Register;