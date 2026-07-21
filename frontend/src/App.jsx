import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import StudentViews from './components/StudentViews';
import TraineeViews from './components/TraineeViews';
import AdminViews from './components/AdminViews';
import Login from './components/Login';
import logoImage from './assets/rakansiswalogo.png';
import {
  fetchPosts, fetchMoodLogs, fetchChats, fetchTrainees,
  fetchAppointments, fetchNotifications, fetchAllUsers,
  fetchFlaggedPosts, fetchSystemLogs, fetchAnalyticsSummary, fetchMe,
} from './api';

export default function App() {
  // ── Auth & UI state ──
  const [currentRole, setCurrentRole]           = useState('student');
  const [studentTab, setStudentTab]             = useState('dashboard');
  const [traineeTab, setTraineeTab]             = useState('dashboard');
  const [adminTab, setAdminTab]                 = useState('overview');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isLoggedIn, setIsLoggedIn]             = useState(false);
  const [isLoading, setIsLoading]               = useState(false);
  const [loadError, setLoadError]               = useState('');

  // ── Per-user data (populated from API after login) ──
  const [studentStats, setStudentStats]   = useState({ postsShared: 0, sessionsBooked: 0, moodStreak: '0d', activeChats: 0 });
  const [traineeStats, setTraineeStats]   = useState({ pendingRequests: 0, confirmedToday: 0, sessionsCompleted: 0, rating: 'N/A' });
  const [posts, setPosts]                 = useState([]);
  const [moodLogs, setMoodLogs]           = useState([]);
  const [chats, setChats]                 = useState([]);
  const [appointments, setAppointments]   = useState([]);
  const [sessions, setSessions]           = useState([]);
  const [flaggedPosts, setFlaggedPosts]   = useState([]);
  const [users, setUsers]                 = useState([]);
  const [systemLogs, setSystemLogs]       = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [studentProfile, setStudentProfile] = useState({ nickname: '', email: '', gender: '' });
  const [traineeProfile, setTraineeProfile] = useState({ name: '', available: true, specialty: '', languages: '', rating: 0, sessions_done: 0 });

  // ── Load all data relevant to the logged-in role ──
  const loadData = async (role) => {
    setIsLoading(true);
    setLoadError('');
    try {
      if (role === 'student') {
        const [postsData, moodData, chatsData, traineesData, aptsData, notifsData, meData] = await Promise.all([
          fetchPosts(),
          fetchMoodLogs(),
          fetchChats(),
          fetchTrainees(),
          fetchAppointments(),
          fetchNotifications(),
          fetchMe(),
        ]);

        // Posts
        setPosts(postsData.map(p => ({
          id: p.id,
          author: p.author,
          avatar: p.author.slice(-2),
          time: formatTime(p.created_at),
          category: p.category,
          content: p.content,
          likes: p.likes,
          comments: p.comments_count,
          aiVerified: p.ai_verified,
        })));

        // Mood logs
        setMoodLogs(moodData.map(m => ({
          day: new Date(m.logged_date).toLocaleDateString([], { weekday: 'short' }),
          mood: m.mood,
          emoji: m.emoji || moodEmoji(m.mood),
          date: m.logged_date,
        })));

        // Chat threads
        setChats(chatsData.map(c => ({
          id: c.id,
          name: c.partner_name,
          avatar: c.partner_name.slice(-2),
          time: formatTime(c.last_message_at),
          lastMessage: c.last_message || 'No messages yet',
          unread: c.unread_count,
          messages: [], // loaded lazily when chat is opened
        })));

        // Counsellors / trainees list
        setAppointments(traineesData.map(t => ({
          counsellorId: t.user_id,
          name: t.anonymous_name,
          avatar: t.anonymous_name.slice(-2),
          specialty: t.specialty || 'General Support',
          available: t.is_available,
          rating: String(t.rating),
          languages: t.languages || 'EN',
          gender: t.gender || 'N/A',
          nextSlot: t.next_slot || 'Contact to arrange',
          status: 'Request session',
        })));

        // Sessions (student's own appointments)
        setSessions(aptsData);

        // Notifications
        setNotifications(notifsData.map(n => ({
          id: n.id,
          text: n.message,
          time: formatTime(n.created_at),
          icon: n.icon || 'Bell',
        })));

        // Student profile
        setStudentProfile({ nickname: meData.anonymous_name, email: meData.email, gender: meData.gender || '' });

        // Stats derived from data
        const streak = calcStreak(moodData);
        setStudentStats({
          postsShared: postsData.filter(p => p.author === meData.anonymous_name).length,
          sessionsBooked: aptsData.length,
          moodStreak: streak > 0 ? `${streak}d` : '0d',
          activeChats: chatsData.filter(c => c.unread_count > 0).length,
        });

      } else if (role === 'trainee') {
        const [chatsData, aptsData, notifsData, meData] = await Promise.all([
          fetchChats(),
          fetchAppointments(),
          fetchNotifications(),
          fetchMe(),
        ]);

        // Trainee's chat threads
        setChats(chatsData.map(c => ({
          id: c.id,
          name: c.partner_name,
          avatar: c.partner_name.slice(-2),
          time: formatTime(c.last_message_at),
          lastMessage: c.last_message || 'No messages yet',
          unread: c.unread_count,
          messages: [],
        })));

        // Appointments
        setAppointments(aptsData);
        setSessions(aptsData.filter(a => ['Improved', 'Resolved', 'Ongoing'].includes(a.status)));

        // Notifications
        setNotifications(notifsData.map(n => ({
          id: n.id,
          text: n.message,
          time: formatTime(n.created_at),
          icon: n.icon || 'Bell',
        })));

        setTraineeProfile({
          name: meData.anonymous_name,
          available: true,
          specialty: '',
          languages: '',
          rating: 0,
          sessions_done: 0,
        });

        // Stats from appointments
        const pending = aptsData.filter(a => a.status === 'Pending').length;
        const confirmed = aptsData.filter(a => a.status === 'Confirmed').length;
        const done = aptsData.filter(a => ['Improved', 'Resolved'].includes(a.status)).length;
        setTraineeStats({ pendingRequests: pending, confirmedToday: confirmed, sessionsCompleted: done, rating: 'N/A' });

      } else if (role === 'admin') {
        const [usersData, flaggedData, logsData, analyticsData, notifsData] = await Promise.all([
          fetchAllUsers(),
          fetchFlaggedPosts(),
          fetchSystemLogs(),
          fetchAnalyticsSummary(),
          fetchNotifications(),
        ]);

        setUsers(usersData.map(u => ({
          id: u.id,
          name: u.anonymous_name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          joined: new Date(u.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' }),
          flags: u.flag_count,
          status: u.status,
        })));

        setFlaggedPosts(flaggedData.map(f => ({
          id: f.id,
          flagId: f.id,
          postId: f.post_id,
          author: f.author,
          time: formatTime(f.created_at),
          category: f.category,
          toxicity: String(f.toxicity_score),
          originalContent: f.content,
        })));

        setSystemLogs(logsData.map(l => ({
          id: l.id,
          event: l.description,
          time: formatTime(l.created_at),
          actor: l.actor_name,
        })));

        setAdminAnalytics(analyticsData);
        setTraineeStats({
          pendingRequests: analyticsData.pending_appointments,
          confirmedToday: analyticsData.sessions_this_week,
          sessionsCompleted: analyticsData.total_posts,
          rating: analyticsData.flagged_posts_count,
        });

        setNotifications(notifsData.map(n => ({
          id: n.id,
          text: n.message,
          time: formatTime(n.created_at),
          icon: n.icon || 'Bell',
        })));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setLoadError(err.message || 'Failed to load data. Backend may be down.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helpers ──
  const moodEmoji = (mood) => {
    const map = { Happy: '😊', Calm: '😌', Stressed: '😣', Anxious: '😰', Sad: '😢', Angry: '😡', Overwhelmed: '🥴' };
    return map[mood] || '😐';
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch { return ''; }
  };

  const calcStreak = (logs) => {
    if (!logs.length) return 0;
    const sorted = [...logs].sort((a, b) => new Date(b.logged_date) - new Date(a.logged_date));
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].logged_date);
      const curr = new Date(sorted[i].logged_date);
      const diff = Math.round((prev - curr) / 86400000);
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  };

  // ── Login handler ──
  const handleLoginSuccess = (role, nickname) => {
    setCurrentRole(role);
    setStudentTab('dashboard');
    setTraineeTab('dashboard');
    setAdminTab('overview');
    setIsLoggedIn(true);
    loadData(role);
  };

  // ── Logout ──
  const handleLogout = () => {
    sessionStorage.removeItem('rs_token');
    sessionStorage.removeItem('rs_role');
    sessionStorage.removeItem('rs_anon_name');
    sessionStorage.removeItem('rs_user_id');
    setIsLoggedIn(false);
    setPosts([]); setMoodLogs([]); setChats([]); setAppointments([]);
    setSessions([]); setFlaggedPosts([]); setUsers([]); setSystemLogs([]);
    setNotifications([]); setAdminAnalytics(null);
    setStudentProfile({ nickname: '', email: '', gender: '' });
    setTraineeProfile({ name: '', available: true });
    setStudentTab('dashboard'); setTraineeTab('dashboard'); setAdminTab('overview');
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--bg)' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid var(--primary-light)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading your data…</p>
        {loadError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', maxWidth: '400px', textAlign: 'center' }}>{loadError}</p>}
      </div>
    );
  }

  return (
    <div className="app-container">

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? <Icons.ChevronRight size={14} /> : <Icons.ChevronLeft size={14} />}
        </button>

        <div className="logo-container">
          <img src={logoImage} alt="Logo" className="logo-icon" style={{ padding: '0', objectFit: 'cover' }} />
          {!isSidebarCollapsed && (
            <div>
              <div className="logo-text">Rakan Siswa</div>
              <div className="logo-subtext">Peer Support</div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">

          {/* STUDENT MENU */}
          {currentRole === 'student' && (
            <>
              {[
                { id: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
                { id: 'feed',      icon: 'Rss',             label: 'Social Feed' },
                { id: 'mood',      icon: 'Smile',           label: 'Mood Tracker' },
                { id: 'chat',      icon: 'MessageSquare',   label: 'Peer Chat' },
                { id: 'counselling', icon: 'Calendar',      label: 'Counselling' },
                { id: 'notifications', icon: 'Bell',        label: 'Notifications' },
                { id: 'profile',   icon: 'User',            label: 'My Profile' },
              ].map(({ id, icon, label }) => {
                const Ic = Icons[icon];
                return (
                  <button key={id} className={`sidebar-btn ${studentTab === id ? 'active' : ''}`} onClick={() => setStudentTab(id)} title={label}>
                    <Ic size={18} />{!isSidebarCollapsed && <span>{label}</span>}
                  </button>
                );
              })}
            </>
          )}

          {/* TRAINEE MENU */}
          {currentRole === 'trainee' && (
            <>
              {[
                { id: 'dashboard',     icon: 'LayoutDashboard', label: 'Dashboard' },
                { id: 'appointments',  icon: 'CalendarRange',   label: 'Appointments' },
                { id: 'chats',         icon: 'MessageSquare',   label: 'Active Chats' },
                { id: 'sessions',      icon: 'History',         label: 'Sessions' },
                { id: 'notifications', icon: 'Bell',            label: 'Notifications' },
                { id: 'profile',       icon: 'UserCheck',       label: 'Trainee Profile' },
              ].map(({ id, icon, label }) => {
                const Ic = Icons[icon];
                return (
                  <button key={id} className={`sidebar-btn ${traineeTab === id ? 'active' : ''}`} onClick={() => setTraineeTab(id)} title={label}>
                    <Ic size={18} />{!isSidebarCollapsed && <span>{label}</span>}
                  </button>
                );
              })}
            </>
          )}

          {/* ADMIN MENU */}
          {currentRole === 'admin' && (
            <>
              {[
                { id: 'overview',      icon: 'Activity',    label: 'Overview' },
                { id: 'analytics',     icon: 'BarChart3',   label: 'Analytics' },
                { id: 'moderator',     icon: 'Cpu',         label: 'AI Moderator' },
                { id: 'flagged',       icon: 'Flag',        label: 'Flagged Posts' },
                { id: 'users',         icon: 'Users',       label: 'User Management' },
                { id: 'notifications', icon: 'Bell',        label: 'Notifications' },
              ].map(({ id, icon, label }) => {
                const Ic = Icons[icon];
                return (
                  <button key={id} className={`sidebar-btn ${adminTab === id ? 'active' : ''}`} onClick={() => setAdminTab(id)} title={label}>
                    <Ic size={18} />{!isSidebarCollapsed && <span>{label}</span>}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="anonymous-badge">
            <div className="anonymous-badge-header">
              <Icons.Lock size={12} className="text-primary" /> {!isSidebarCollapsed && 'Anonymous Mode'}
            </div>
            {!isSidebarCollapsed && 'Your identity is protected by AI moderation.'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${isSidebarCollapsed ? 'collapsed' : ''}`}>

        {/* Top Header */}
        <header className="top-nav">
          <div className="page-title-container">
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>
              {currentRole === 'student' && 'Dashboard'}
              {currentRole === 'trainee' && 'Appointments'}
              {currentRole === 'admin'   && 'System Analytics'}
            </h1>
            <span className="role-tag">
              {currentRole === 'student' && `Student · ${studentProfile.nickname}`}
              {currentRole === 'trainee' && `Psychology Trainee · ${traineeProfile.name}`}
              {currentRole === 'admin'   && 'Administrator'}
            </span>
          </div>

          <div className="top-actions">
            {/* Refresh button */}
            <button
              className="btn btn-outline"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => loadData(currentRole)}
              title="Refresh data"
            >
              <Icons.RefreshCw size={14} />
            </button>

            {/* Notification Bell */}
            <button className="notification-bell" onClick={() => {
              if (currentRole === 'student') setStudentTab('notifications');
              if (currentRole === 'trainee') setTraineeTab('notifications');
              if (currentRole === 'admin')   setAdminTab('notifications');
            }} title="Notifications">
              <Icons.Bell size={18} />
              {notifications.length > 0 && <div className="notification-badge">{notifications.length}</div>}
            </button>

            {/* Logout */}
            <button className="logout-btn" onClick={handleLogout} title="Sign Out">
              <Icons.LogOut size={18} />
            </button>
          </div>
        </header>

        {/* View Switcher */}
        <div style={{ flex: 1 }}>
          {currentRole === 'student' && (
            <StudentViews
              currentTab={studentTab}
              setCurrentTab={setStudentTab}
              stats={studentStats}
              setStats={setStudentStats}
              posts={posts}
              setPosts={setPosts}
              moodLogs={moodLogs}
              setMoodLogs={setMoodLogs}
              chats={chats}
              setChats={setChats}
              appointments={appointments}
              setAppointments={setAppointments}
              sessions={sessions}
              notifications={notifications}
              setNotifications={setNotifications}
              profile={studentProfile}
              setProfile={setStudentProfile}
              onDataRefresh={() => loadData('student')}
            />
          )}

          {currentRole === 'trainee' && (
            <TraineeViews
              currentTab={traineeTab}
              setCurrentTab={setTraineeTab}
              stats={traineeStats}
              setStats={setTraineeStats}
              appointments={appointments}
              setAppointments={setAppointments}
              chats={chats}
              setChats={setChats}
              sessions={sessions}
              setSessions={setSessions}
              notifications={notifications}
              setNotifications={setNotifications}
              traineeProfile={traineeProfile}
              setTraineeProfile={setTraineeProfile}
              onDataRefresh={() => loadData('trainee')}
            />
          )}

          {currentRole === 'admin' && (
            <AdminViews
              currentTab={adminTab}
              setCurrentTab={setAdminTab}
              analytics={adminAnalytics}
              posts={posts}
              setPosts={setPosts}
              flaggedPosts={flaggedPosts}
              setFlaggedPosts={setFlaggedPosts}
              users={users}
              setUsers={setUsers}
              notifications={notifications}
              setNotifications={setNotifications}
              systemLogs={systemLogs}
              setSystemLogs={setSystemLogs}
              onDataRefresh={() => loadData('admin')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
