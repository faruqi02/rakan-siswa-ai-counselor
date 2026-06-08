import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { moderatePost, updateUserStatus, fetchAnalyticsSummary } from '../api';

export default function AdminViews({
  currentTab,
  setCurrentTab,
  analytics,
  posts,
  setPosts,
  flaggedPosts,
  setFlaggedPosts,
  users,
  setUsers,
  notifications,
  setNotifications,
  systemLogs,
  setSystemLogs,
  onDataRefresh,
}) {

  // ── Moderator UI state (local only — these are config, not DB) ──
  const [toxicityThreshold, setToxicityThreshold]         = useState(0.70);
  const [cyberbullyingThreshold, setCyberbullyingThreshold] = useState(0.65);
  const [selfHarmThreshold, setSelfHarmThreshold]         = useState(0.50);
  const [autoBlock, setAutoBlock]                         = useState(true);
  const [autoNotify, setAutoNotify]                       = useState(true);
  const [sentimentAnalysis, setSentimentAnalysis]         = useState(true);
  const [crisisHotline, setCrisisHotline]                 = useState(true);

  // ── Anomaly alert ──
  const [anomalyDismissed, setAnomalyDismissed]           = useState(false);

  // ── User search ──
  const [userSearch, setUserSearch]                       = useState('');

  // ── Flagged post actions ──
  const handleMarkSafe = async (post) => {
    try {
      await moderatePost(post.flagId, 'Approved', 'Admin reviewed — content deemed safe');
      setFlaggedPosts(prev => prev.filter(p => p.id !== post.id));
      alert(`Post #${post.postId} approved and restored to the feed.`);
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleRemoveAndWarn = async (post) => {
    try {
      // Block the post
      await moderatePost(post.flagId, 'Blocked', 'Admin blocked — policy violation');
      setFlaggedPosts(prev => prev.filter(p => p.id !== post.id));

      // Suspend the user
      const userRow = users.find(u => u.name === post.author);
      if (userRow) {
        await updateUserStatus(userRow.id, 'Suspended');
        setUsers(prev => prev.map(u => u.name === post.author ? { ...u, status: 'Suspended', flags: (u.flags || 0) + 1 } : u));
      }

      alert(`Post removed. User ${post.author} has been suspended.`);
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleDismissFlag = async (post) => {
    try {
      await moderatePost(post.flagId, 'Dismissed', 'Flag dismissed by admin');
      setFlaggedPosts(prev => prev.filter(p => p.id !== post.id));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  // ── User management ──
  const handleManageUser = async (user) => {
    const newStatus = user.status === 'Active' ? 'Suspended' : 'Active';
    const confirmMsg = user.status === 'Active'
      ? `Suspend user ${user.name}?`
      : `Restore ${user.name} to Active?`;

    if (!window.confirm(confirmMsg)) return;
    try {
      await updateUserStatus(user.id, newStatus);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Analytics numbers (from API or fallbacks) ──
  const totalUsers    = analytics?.total_users          ?? users.length;
  const activeStudents = analytics?.active_students     ?? users.filter(u => u.role === 'student' && u.status === 'Active').length;
  const activeTrainees = analytics?.active_trainees     ?? users.filter(u => u.role === 'trainee').length;
  const totalPosts     = analytics?.total_posts         ?? posts.length;
  const flaggedCount   = analytics?.flagged_posts_count ?? flaggedPosts.length;
  const moodToday      = analytics?.mood_logs_today     ?? 0;
  const sessionsWeek   = analytics?.sessions_this_week  ?? 0;
  const pendingApts    = analytics?.pending_appointments ?? 0;

  return (
    <div className="animated-view">

      {/* ─────────── OVERVIEW ─────────── */}
      {currentTab === 'overview' && (
        <div>
          <div className="dashboard-hero" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)', borderColor: 'rgba(239, 68, 68, 0.1)' }}>
            <div className="hero-content">
              <h2 style={{ background: 'linear-gradient(135deg, #dc2626 0%, #f43f5e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Admin Control Center 🔒
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Monitor system logs, audit flagged posts, and configure the BERT AI moderator.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setCurrentTab('flagged')}>
              Review Flags ({flaggedCount})
            </button>
          </div>

          <div className="stats-grid">
            <div className="glass-card stat-card">
              <span className="stat-label">Total Users</span>
              <span className="stat-value">{totalUsers}</span>
              <Icons.Users size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Flagged Posts</span>
              <span className="stat-value">{flaggedCount}</span>
              <Icons.Flag size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(239, 68, 68, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Sessions This Week</span>
              <span className="stat-value">{sessionsWeek}</span>
              <Icons.Calendar size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(16, 185, 129, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Pending Appointments</span>
              <span className="stat-value">{pendingApts}</span>
              <Icons.Clock size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="glass-card">
              <h3>System events & logs</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Real-time server audits</p>
              {systemLogs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No logs yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {systemLogs.slice(0, 6).map((log, idx) => (
                    <div key={log.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-main)' }}>{log.event}</span>
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>{log.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '1rem' }}>Platform summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                {[
                  { label: 'Active students', value: activeStudents, color: '#8b5cf6' },
                  { label: 'Active trainees', value: activeTrainees, color: '#10b981' },
                  { label: 'Total posts', value: totalPosts, color: '#3b82f6' },
                  { label: 'Mood logs today', value: moodToday, color: '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: '700', color }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '0.75rem 1rem' }} onClick={() => setCurrentTab('analytics')}>
                  <span>Analytics dashboard</span><Icons.ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '0.75rem 1rem' }} onClick={() => setCurrentTab('users')}>
                  <span>Manage user databases</span><Icons.ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── ANALYTICS ─────────── */}
      {currentTab === 'analytics' && (
        <div>
          {!anomalyDismissed && flaggedCount > 0 && (
            <div className="anomaly-alert">
              <div className="anomaly-header">
                <Icons.AlertTriangle size={18} />
                <span>Anomaly detected: {flaggedCount} post{flaggedCount > 1 ? 's' : ''} flagged for review</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.4' }}>
                Flagged content awaiting moderation. Recommended: review flagged posts and take action.
              </p>
              <button className="btn btn-danger" style={{ alignSelf: 'flex-start', marginTop: '0.5rem', padding: '0.5rem 1rem' }} onClick={() => { setAnomalyDismissed(true); setCurrentTab('flagged'); }}>
                Review now
              </button>
            </div>
          )}

          <div className="dashboard-grid">
            <div className="glass-card">
              <h3>Posts by category</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Top issues reported</p>
              <div className="svg-chart-container">
                <svg viewBox="0 0 500 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <line x1="0" y1="150" x2="500" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="50" y="30" width="50" height="120" rx="4" fill="url(#blueGrad)" />
                  <rect x="160" y="10" width="50" height="140" rx="4" fill="url(#pinkGrad)" />
                  <rect x="270" y="70" width="50" height="80" rx="4" fill="url(#yellowGrad)" />
                  <rect x="380" y="60" width="50" height="90" rx="4" fill="url(#purpleGrad2)" />
                  <defs>
                    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" /></linearGradient>
                    <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ec4899" /><stop offset="100%" stopColor="#be185d" /></linearGradient>
                    <linearGradient id="yellowGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" /></linearGradient>
                    <linearGradient id="purpleGrad2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#5b21b6" /></linearGradient>
                  </defs>
                  <text x="75" y="170" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="var(--font-sans)">Academic</text>
                  <text x="185" y="170" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="var(--font-sans)">Mental Health</text>
                  <text x="295" y="170" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="var(--font-sans)">Financial</text>
                  <text x="405" y="170" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="var(--font-sans)">Relationships</text>
                </svg>
              </div>
            </div>

            <div className="glass-card">
              <h3>Live platform stats</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>From database</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                {[
                  { label: 'Total registered users', value: totalUsers },
                  { label: 'Active students', value: activeStudents },
                  { label: 'Active trainees', value: activeTrainees },
                  { label: 'Total posts in feed', value: totalPosts },
                  { label: 'Pending appointments', value: pendingApts },
                  { label: 'Sessions this week', value: sessionsWeek },
                  { label: 'Mood logs today', value: moodToday },
                  { label: 'Pending flags', value: flaggedCount },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }} onClick={onDataRefresh}>
                <Icons.RefreshCw size={14} /> Refresh stats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── AI MODERATOR ─────────── */}
      {currentTab === 'moderator' && (
        <div className="dashboard-grid">
          <div className="glass-card">
            <h3>BERT NLP Moderator</h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--success)', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span> Online
            </span>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Real-time analysis of every post for toxicity, cyberbullying, and self-harm.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { label: 'Toxicity Threshold', val: toxicityThreshold, set: setToxicityThreshold },
                { label: 'Cyberbullying Threshold', val: cyberbullyingThreshold, set: setCyberbullyingThreshold },
                { label: 'Self-harm Threshold', val: selfHarmThreshold, set: setSelfHarmThreshold },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: '600' }}>{label}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{val.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={val} onChange={(e) => set(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h3>Moderator settings</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Model behaviors</p>
            {[
              { label: 'Auto-block toxic posts', desc: 'Block before publishing', val: autoBlock, set: setAutoBlock },
              { label: 'Auto-notify admin', desc: 'Email alert on flag', val: autoNotify, set: setAutoNotify },
              { label: 'Sentiment analysis', desc: 'Tag every post', val: sentimentAnalysis, set: setSentimentAnalysis },
              { label: 'Crisis hotline trigger', desc: 'Show helpline on self-harm', val: crisisHotline, set: setCrisisHotline },
            ].map(({ label, desc, val, set }) => (
              <div className="toggle-switch-row" key={label}>
                <div className="toggle-label-container">
                  <span className="toggle-title">{label}</span>
                  <span className="toggle-desc">{desc}</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
                  <span className="slider-round"></span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────── FLAGGED POSTS ─────────── */}
      {currentTab === 'flagged' && (
        <div>
          <h3 style={{ marginBottom: '0.25rem' }}>Flagged Posts</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {flaggedPosts.length} post{flaggedPosts.length !== 1 ? 's' : ''} require your review
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {flaggedPosts.map((post) => (
              <div className="glass-card" key={post.id} style={{ borderLeft: '4px solid var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="avatar-circle" style={{ width: '2rem', height: '2rem', fontSize: '0.8rem' }}>{post.author.slice(-2)}</div>
                    <strong>{post.author}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· {post.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: '700' }}>Toxicity: {parseFloat(post.toxicity).toFixed(2)}</span>
                    <span className="post-category-badge" style={{ background: '#fee2e2', color: 'var(--danger)' }}>{post.category}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed rgba(239, 68, 68, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
                  [Content hidden — flagged for {post.category.toLowerCase()} references]
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => alert(`Original Text:\n"${post.originalContent}"`)}>
                    View original
                  </button>
                  <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => handleDismissFlag(post)}>
                    Dismiss
                  </button>
                  <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--success)' }} onClick={() => handleMarkSafe(post)}>
                    Mark safe
                  </button>
                  <button className="btn btn-danger" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => handleRemoveAndWarn(post)}>
                    Remove & warn user
                  </button>
                </div>
              </div>
            ))}

            {flaggedPosts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Icons.CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                <p>Clean database! No posts currently flagged for review.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── USER MANAGEMENT ─────────── */}
      {currentTab === 'users' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3>User Database</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>UMS encrypted directory — {users.length} users registered</p>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder="Search anonymous IDs…"
              style={{ maxWidth: '250px' }}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          {users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.Users size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No users found.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Anonymous ID</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Flags Issued</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="avatar-circle" style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem' }}>{user.name.slice(-2)}</div>
                          <strong>{user.name}</strong>
                        </div>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                      <td>{user.joined}</td>
                      <td>{user.flags || 0}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: user.status === 'Active' ? 'var(--success)' : 'var(--danger)', background: user.status === 'Active' ? '#d1fae5' : '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleManageUser(user)}>
                          {user.status === 'Active' ? 'Suspend' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────── NOTIFICATIONS ─────────── */}
      {currentTab === 'notifications' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Admin Notifications</h3>
          {notifications.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.Bell size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No notifications.</p>
            </div>
          ) : notifications.map(notif => (
            <div className="notification-item" key={notif.id}>
              <div className="notification-icon-wrapper" style={{ background: '#fee2e2', color: 'var(--danger)' }}>
                <Icons.AlertTriangle size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{notif.text}</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notif.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
