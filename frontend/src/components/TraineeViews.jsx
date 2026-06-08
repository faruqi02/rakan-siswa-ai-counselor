import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { updateAppointment, fetchMessages, sendMessage, updateTraineeProfile, fetchUserStatus } from '../api';

export default function TraineeViews({
  currentTab,
  setCurrentTab,
  stats,
  setStats,
  appointments,
  setAppointments,
  chats,
  setChats,
  sessions,
  setSessions,
  notifications,
  setNotifications,
  traineeProfile,
  setTraineeProfile,
  onDataRefresh,
}) {

  // ── Chat ──
  const [activeThread, setActiveThread]   = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [replyText, setReplyText]         = useState('');
  const [chatLoading, setChatLoading]     = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const messagesEndRef                    = useRef(null);

  // ── Profile ──
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);

  // ── Load messages on active thread change ──
  useEffect(() => {
    if (!activeThread) return;
    
    const loadChat = () => {
      fetchMessages(activeThread.id)
        .then(msgs => {
          const myName = traineeProfile.name || sessionStorage.getItem('rs_anon_name');
          setActiveMessages(msgs.map(m => ({
            sender: m.sender === myName ? 'me' : 'them',
            text: m.content,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })));
        })
        .catch(console.error);

      if (activeThread.name) {
        fetchUserStatus(activeThread.name)
          .then(res => setIsPartnerOnline(res.is_online))
          .catch(() => setIsPartnerOnline(false));
      }
    };

    setChatLoading(true);
    loadChat();
    setTimeout(() => setChatLoading(false), 500);

    const interval = setInterval(loadChat, 3000);
    return () => clearInterval(interval);
  }, [activeThread, traineeProfile.name]);

  // ── Auto-scroll ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages]);

  // ── Set first thread on load ──
  useEffect(() => {
    if (chats.length > 0 && !activeThread) setActiveThread(chats[0]);
  }, [chats]);

  // ── Accept appointment ──
  const handleAcceptAppointment = async (aptId) => {
    try {
      await updateAppointment(aptId, 'Confirmed');
      setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: 'Confirmed' } : a));
      setStats(prev => ({
        ...prev,
        pendingRequests: Math.max(0, prev.pendingRequests - 1),
        confirmedToday: prev.confirmedToday + 1,
      }));
    } catch (err) {
      alert('Failed to accept: ' + err.message);
    }
  };

  // ── Decline appointment ──
  const handleDeclineAppointment = async (aptId) => {
    try {
      await updateAppointment(aptId, 'Cancelled');
      setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: 'Cancelled' } : a));
      setStats(prev => ({ ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) }));
    } catch (err) {
      alert('Failed to decline: ' + err.message);
    }
  };

  // ── Send reply ──
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThread) return;
    const text = replyText.trim();
    setReplyText('');
    try {
      await sendMessage(activeThread.id, text);
      setActiveMessages(prev => [...prev, {
        sender: 'me',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setChats(prev => prev.map(c => c.id === activeThread.id ? { ...c, lastMessage: text, time: 'Just now' } : c));
    } catch (err) {
      console.error('Reply failed:', err);
    }
  };

  // ── Save trainee profile ──
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateTraineeProfile({ is_available: traineeProfile.available });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Mark session resolved ──
  const handleMarkResolved = async (aptId) => {
    try {
      await updateAppointment(aptId, 'Resolved');
      setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: 'Resolved' } : a));
      setSessions(prev => prev.map(s => s.id === aptId ? { ...s, status: 'Resolved' } : s));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const pendingApts   = appointments.filter(a => a.status === 'Pending');
  const confirmedApts = appointments.filter(a => a.status === 'Confirmed');
  const myName        = sessionStorage.getItem('rs_anon_name') || traineeProfile.name;

  return (
    <div className="animated-view">

      {/* ─────────── DASHBOARD ─────────── */}
      {currentTab === 'dashboard' && (
        <div>
          <div className="dashboard-hero">
            <div className="hero-content">
              <h2>Hello Helper, {traineeProfile.name || myName} 💜</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                {pendingApts.length > 0
                  ? `${pendingApts.length} student${pendingApts.length > 1 ? 's' : ''} need your support. You're making a difference.`
                  : 'No pending requests right now. Stay available!'}
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setCurrentTab('appointments')}>
              View Queue
            </button>
          </div>

          <div className="stats-grid">
            <div className="glass-card stat-card">
              <span className="stat-label">Pending requests</span>
              <span className="stat-value">{stats.pendingRequests}</span>
              <Icons.Clock size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Confirmed today</span>
              <span className="stat-value">{stats.confirmedToday}</span>
              <Icons.CheckCircle2 size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Sessions completed</span>
              <span className="stat-value">{stats.sessionsCompleted}</span>
              <Icons.Award size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Rating</span>
              <span className="stat-value">{stats.rating === 'N/A' ? '—' : `${stats.rating} ★`}</span>
              <Icons.Star size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3>Upcoming sessions</h3>
                <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setCurrentTab('appointments')}>View all</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[...pendingApts, ...confirmedApts].slice(0, 3).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No upcoming sessions.</p>
                ) : [...pendingApts, ...confirmedApts].slice(0, 3).map((app) => (
                  <div className="timeline-item" key={app.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar-circle" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                        {app.student_name ? app.student_name.slice(-2) : '??'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{app.student_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.topic} · {new Date(app.scheduled_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: app.status === 'Confirmed' ? 'var(--success)' : 'var(--warning)', background: app.status === 'Confirmed' ? '#d1fae5' : '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {app.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '1.25rem' }}>Quick actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '1rem' }} onClick={() => setCurrentTab('appointments')}>
                  <span>Manage appointment queue</span><Icons.ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '1rem' }} onClick={() => setCurrentTab('chats')}>
                  <span>Active student chats</span><Icons.ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '1rem' }} onClick={() => setCurrentTab('profile')}>
                  <span>Update availability</span><Icons.ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── APPOINTMENTS ─────────── */}
      {currentTab === 'appointments' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>Appointments queue</h3>
          {appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.CalendarRange size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No appointments yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Topic</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="avatar-circle" style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.75rem' }}>
                            {app.student_name ? app.student_name.slice(-2) : '??'}
                          </div>
                          <strong>{app.student_name}</strong>
                        </div>
                      </td>
                      <td>{app.topic}</td>
                      <td>{new Date(app.scheduled_at).toLocaleString()}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: app.status === 'Confirmed' ? 'var(--success)' : app.status === 'Pending' ? 'var(--warning)' : 'var(--text-muted)', background: app.status === 'Confirmed' ? '#d1fae5' : app.status === 'Pending' ? '#fef3c7' : '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {app.status}
                        </span>
                      </td>
                      <td>
                        {app.status === 'Pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleDeclineAppointment(app.id)}>Decline</button>
                            <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleAcceptAppointment(app.id)}>Accept</button>
                          </div>
                        ) : app.status === 'Confirmed' ? (
                          <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--success)' }} onClick={() => handleMarkResolved(app.id)}>Mark Resolved</button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────── CHATS ─────────── */}
      {currentTab === 'chats' && (
        <div className="chat-layout">
          <div className="chat-list-panel">
            <div className="chat-search-container">
              <input type="text" className="search-input" placeholder="Search active chats…" />
            </div>
            <div className="chat-users-list">
              {chats.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No active student chats.
                </div>
              ) : chats.map((c) => (
                <button key={c.id} className={`chat-user-item ${activeThread?.id === c.id ? 'active' : ''}`} onClick={() => setActiveThread(c)}>
                  <div className="avatar-circle">{c.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{c.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.time}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                      {c.lastMessage}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="chat-window">
            {!activeThread ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Select a conversation
              </div>
            ) : (
              <>
                <div className="chat-window-header">
                  <div className="chat-window-avatar">{activeThread.avatar}</div>
                  <div>
                    <div className="chat-window-title">{activeThread.name}</div>
                    <div className="chat-window-status">
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', background: isPartnerOnline ? '#10b981' : '#9ca3af', borderRadius: '50%', marginRight: '4px' }}></span>
                      <span style={{ color: isPartnerOnline ? '#10b981' : '#6b7280', fontWeight: '500' }}>{isPartnerOnline ? 'Online' : 'Offline'}</span> · Active Peer Conversation
                    </div>
                  </div>
                </div>

                <div className="chat-messages">
                  {chatLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                      <Icons.Loader size={20} className="animate-spin" />
                    </div>
                  ) : activeMessages.map((msg, i) => (
                    <div key={i} className={`message-bubble ${msg.sender === 'me' ? 'outgoing' : 'incoming'}`}>
                      {msg.text}
                      <div className="message-time">{msg.time}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Reply with kindness…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(); }}
                  />
                  <button className="btn btn-primary" style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', padding: 0 }} onClick={handleSendReply}>
                    <Icons.Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────── SESSIONS ─────────── */}
      {currentTab === 'sessions' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Session history</h3>
          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.History size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No completed sessions yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Topic</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => (
                    <tr key={sess.id}>
                      <td><strong>{sess.student_name}</strong></td>
                      <td>{sess.topic}</td>
                      <td>{new Date(sess.scheduled_at).toLocaleDateString()}</td>
                      <td>{sess.duration_min} min</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: ['Improved', 'Resolved'].includes(sess.status) ? 'var(--success)' : 'var(--primary)', background: ['Improved', 'Resolved'].includes(sess.status) ? '#d1fae5' : '#ece9fc', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {sess.status}
                        </span>
                      </td>
                      <td>{sess.student_rating ? '⭐'.repeat(sess.student_rating) : '—'}</td>
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
          <h3 style={{ marginBottom: '1.5rem' }}>Trainee Notifications</h3>
          {notifications.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.Bell size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No notifications.</p>
            </div>
          ) : notifications.map(notif => (
            <div className="notification-item" key={notif.id}>
              <div className="notification-icon-wrapper" style={{ background: '#d1fae5', color: '#059669' }}>
                <Icons.Bell size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{notif.text}</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notif.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────── PROFILE ─────────── */}
      {currentTab === 'profile' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="avatar-circle" style={{ width: '4.5rem', height: '4.5rem', fontSize: '1.75rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              {(traineeProfile.name || myName).slice(-2)}
            </div>
            <div>
              <h3>{traineeProfile.name || myName}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>UMS Psychology Trainee</p>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <span style={{ padding: '0.2rem 0.5rem', background: '#ece9fc', color: 'var(--primary)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>Supervisor Approved</span>
                <span style={{ padding: '0.2rem 0.5rem', background: '#d1fae5', color: '#065f46', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>Active Support</span>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h4 style={{ marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>Availability settings</h4>

            {profileSaved && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icons.CheckCircle size={16} /> Settings saved successfully.
              </div>
            )}

            <div className="toggle-switch-row">
              <div className="toggle-label-container">
                <span className="toggle-title">Available for new sessions</span>
                <span className="toggle-desc">Allow students to request booking slots from you</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={traineeProfile.available} onChange={(e) => setTraineeProfile({ ...traineeProfile, available: e.target.checked })} />
                <span className="slider-round"></span>
              </label>
            </div>

            <div className="toggle-switch-row">
              <div className="toggle-label-container">
                <span className="toggle-title">Email notifications</span>
                <span className="toggle-desc">Receive instant email alerts for new booking requests</span>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider-round"></span>
              </label>
            </div>

            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
