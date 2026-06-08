import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import logoImage from '../assets/rakansiswalogo.png';

const API_BASE = 'http://localhost:8000';

export default function Login({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAnonName, setRegAnonName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGender, setRegGender] = useState('Male');

  // Demo Credentials List
  const demoUsers = [
    { role: 'student', email: 'student@siswa.ums.edu.my', pass: 'student123', label: 'General Student' },
    { role: 'trainee', email: 'trainee@ums.edu.my', pass: 'trainee123', label: 'Psychology Trainee' },
    { role: 'admin', email: 'admin@ums.edu.my', pass: 'admin123', label: 'Administrator' }
  ];

  const [loading, setLoading] = useState(false);

  // Call backend and store JWT on success
  const callLogin = async (emailVal, passVal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Login failed. Please check your credentials.');
        return;
      }
      // Store token for future API calls
      sessionStorage.setItem('rs_token', data.access_token);
      sessionStorage.setItem('rs_role', data.role);
      sessionStorage.setItem('rs_anon_name', data.anonymous_name);
      sessionStorage.setItem('rs_user_id', data.user_id);
      onLoginSuccess(data.role, data.anonymous_name);
    } catch (err) {
      setError('Cannot reach the server. Make sure the backend is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    await callLogin(email, password);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!regAnonName.trim()) {
      setError('Anonymous Name is required to protect your mental health identity.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          real_name: regName,
          email: regEmail,
          phone: regPhone,
          gender: regGender,
          anonymous_name: regAnonName,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Registration failed.');
        return;
      }
      sessionStorage.setItem('rs_token', data.access_token);
      sessionStorage.setItem('rs_role', data.role);
      sessionStorage.setItem('rs_anon_name', data.anonymous_name);
      sessionStorage.setItem('rs_user_id', data.user_id);
      // ✅ Registration success — go back to login with email pre-filled
      setSuccess(`Welcome, ${data.anonymous_name}! Your account is ready. Please sign in below.`);
      setEmail(regEmail);
      setPassword('');
      setIsRegisterMode(false);
      setError('');
      // Reset registration fields
      setRegName(''); setRegEmail(''); setRegPhone('');
      setRegAnonName(''); setRegPassword(''); setRegGender('Male');
    } catch (err) {
      setError('Cannot reach the server. Make sure the backend is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user) => {
    setEmail(user.email);
    setPassword(user.pass);
    await callLogin(user.email, user.pass);
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card glass-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src={logoImage} alt="Logo" className="login-logo-circle" style={{ padding: '0', objectFit: 'cover', display: 'inline-block' }} />
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.25rem' }}>Rakan Siswa</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>AI Moderated Peer Support & Counselling</p>
        </div>

        {error && (
          <div className="alert-box" style={{ background: '#fef2f2', borderColor: '#fca5a5', marginBottom: '1.5rem' }}>
            <Icons.AlertCircle size={18} style={{ color: 'var(--danger)', marginTop: '2px' }} />
            <p style={{ fontSize: '0.8rem', color: '#991b1b' }}>{error}</p>
          </div>
        )}

        {success && (
          <div className="alert-box" style={{ background: '#f0fdf4', borderColor: '#86efac', marginBottom: '1.5rem' }}>
            <Icons.CheckCircle size={18} style={{ color: '#16a34a', marginTop: '2px' }} />
            <p style={{ fontSize: '0.8rem', color: '#15803d' }}>{success}</p>
          </div>
        )}

        {!isRegisterMode ? (
          /* LOGIN FORM */
          <>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.35rem', fontWeight: '600' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Icons.Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    className="search-input" 
                    placeholder="name@siswa.ums.edu.my" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.35rem', fontWeight: '600' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Icons.Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="search-input" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.7rem', fontSize: '0.9rem', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Need support? </span>
              <button 
                onClick={() => { setIsRegisterMode(true); setError(''); setSuccess(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
              >
                Register here
              </button>
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Icons.Key size={14} className="text-primary" /> Demo Accounts (Quick Login)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {demoUsers.map((user) => (
                  <button
                    key={user.role}
                    onClick={() => handleQuickLogin(user)}
                    className="demo-credential-row"
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>{user.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.email} · pass: <span style={{ fontFamily: 'monospace' }}>{user.pass}</span></div>
                    </div>
                    <Icons.ChevronRight size={14} className="text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* REGISTRATION FORM */
          <>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Full Name (Private)</label>
                <div style={{ position: 'relative' }}>
                  <Icons.User size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="John Doe" 
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Email Address (Private)</label>
                <div style={{ position: 'relative' }}>
                  <Icons.Mail size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    className="search-input" 
                    placeholder="email@siswa.ums.edu.my" 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Phone Number (Private)</label>
                <div style={{ position: 'relative' }}>
                  <Icons.Phone size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input 
                    type="tel" 
                    className="search-input" 
                    placeholder="+60123456789" 
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Gender (Private)</label>
                <div style={{ position: 'relative' }}>
                  <Icons.User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <select 
                    className="search-input" 
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%', height: '40px', background: '#fff', cursor: 'pointer' }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600', color: 'var(--primary)' }}>Anonymous Name (Public ID)</label>
                <div style={{ position: 'relative' }}>
                  <Icons.ShieldAlert size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--primary)' }} />
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="e.g. User#X72P or CalmLotus" 
                    value={regAnonName}
                    onChange={(e) => setRegAnonName(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%', borderColor: 'var(--primary)' }}
                    required
                  />
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                  🔒 This handle is shown in feeds/chats. Real details are encrypted.
                </span>
              </div>

              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Icons.Lock size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="search-input" 
                    placeholder="••••••••" 
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.7rem', fontSize: '0.9rem', marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Registering…' : 'Complete Registration'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Already registered? </span>
              <button 
                onClick={() => { setIsRegisterMode(false); setError(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
              >
                Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
