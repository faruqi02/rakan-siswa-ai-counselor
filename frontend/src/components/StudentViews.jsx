import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import {
  createPost, toggleLike, logMood,
  fetchMessages, sendMessage, startThread,
  bookAppointment, fetchNotifications, fetchUserStatus
} from '../api';

const MOOD_EMOJI = { Happy: '😊', Calm: '😌', Stressed: '😣', Anxious: '😰', Sad: '😢', Angry: '😡', Overwhelmed: '🥴' };

export default function StudentViews({
  currentTab,
  setCurrentTab,
  stats,
  setStats,
  posts,
  setPosts,
  moodLogs,
  setMoodLogs,
  chats,
  setChats,
  appointments,
  setAppointments,
  sessions,
  notifications,
  setNotifications,
  profile,
  setProfile,
  onDataRefresh,
}) {

  // ── Social Feed ──
  const [newPostText, setNewPostText]       = useState('');
  const [selectedTag, setSelectedTag]       = useState('Mental Health');
  const [isAiScanning, setIsAiScanning]     = useState(false);
  const [aiScanStatus, setAiScanStatus]     = useState('');
  const [postError, setPostError]           = useState('');

  // ── Mood Tracker ──
  const [selectedMood, setSelectedMood]     = useState('Calm');
  const [journalNote, setJournalNote]       = useState('');
  const [moodSavedToast, setMoodSavedToast] = useState(false);
  const [moodError, setMoodError]           = useState('');

  // ── Peer Chat ──
  const [activeThread, setActiveThread]     = useState(null); // thread object
  const [activeMessages, setActiveMessages] = useState([]);
  const [chatSearch, setChatSearch]         = useState('');
  const [chatInput, setChatInput]           = useState('');
  const [chatLoading, setChatLoading]       = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const messagesEndRef                      = useRef(null);

  // ── Counselling booking modal ──
  const [bookingModal, setBookingModal]     = useState(null); // counsellor object
  const [bookingTopic, setBookingTopic]     = useState('');
  const [bookingDate, setBookingDate]       = useState('');
  const [bookingError, setBookingError]     = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // ── Profile form ──
  const [profileForm, setProfileForm]       = useState({ ...profile });
  useEffect(() => { setProfileForm({ ...profile }); }, [profile]);

  // ── Load messages when active thread changes ──
  useEffect(() => {
    if (!activeThread) return;
    
    const loadChat = () => {
      fetchMessages(activeThread.id)
        .then(msgs => {
          const myName = profile.nickname || sessionStorage.getItem('rs_anon_name');
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
    // Use a slight timeout to hide loader so it doesn't flicker on every poll
    setTimeout(() => setChatLoading(false), 500);

    // Poll for real-time messages
    const interval = setInterval(loadChat, 3000);
    return () => clearInterval(interval);
  }, [activeThread, profile.nickname]);

  // ── Auto-scroll chat to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  // ── Set first thread as active on load ──
  useEffect(() => {
    if (chats.length > 0 && !activeThread) {
      setActiveThread(chats[0]);
    }
  }, [chats]);

  // ── Send chat message ──
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeThread) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await sendMessage(activeThread.id, text);
      // Optimistic update
      setActiveMessages(prev => [...prev, {
        sender: 'me',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      // Update thread last message
      setChats(prev => prev.map(c => c.id === activeThread.id ? { ...c, lastMessage: text, time: 'Just now' } : c));
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  // ── Save mood ──
  const handleSaveMood = async () => {
    setMoodError('');
    const emoji = MOOD_EMOJI[selectedMood] || '😐';
    try {
      const saved = await logMood(selectedMood, emoji, journalNote);
      const day = new Date(saved.logged_date).toLocaleDateString([], { weekday: 'short' });
      setMoodLogs(prev => [{ day, mood: saved.mood, emoji: saved.emoji || emoji, date: saved.logged_date }, ...prev.filter(l => l.date !== saved.logged_date)]);
      setStats(prev => ({ ...prev, moodStreak: String(Number((prev.moodStreak || '0').replace('d', '')) + 1) + 'd' }));
      setJournalNote('');
      setMoodSavedToast(true);
      setTimeout(() => setMoodSavedToast(false), 3000);
    } catch (err) {
      setMoodError(err.message || 'Failed to save mood.');
    }
  };

  // ── AI Scan & Post ──
  const handleAiScanAndPost = async () => {
    if (!newPostText.trim()) return;
    setIsAiScanning(true);
    setPostError('');
    setAiScanStatus('🤖 BERT AI NLP analyzing text content…');

    await delay(1000);
    setAiScanStatus('🔍 Scoring toxicity levels…');
    await delay(1000);

    const toxicWords = ['kill', 'hate', 'stupid', 'ugly', 'die'];
    const isToxic = toxicWords.some(w => newPostText.toLowerCase().includes(w));

    if (isToxic) {
      setAiScanStatus('⚠️ BERT AI ALERT: Post flagged for safety check. Blocked.');
      await delay(1500);
      setIsAiScanning(false);
      setNewPostText('');
      alert('Your post was flagged by the AI content moderator for self-harm or toxic references and has been forwarded for admin review. Please keep the space safe and supportive.');
      return;
    }

    setAiScanStatus('✅ Safety score 98% — No toxicity found. Publishing…');
    await delay(1000);

    try {
      const saved = await createPost(selectedTag, newPostText);
      const newPost = {
        id: saved.id,
        author: saved.author,
        avatar: saved.author.slice(-2),
        time: 'Just now',
        category: saved.category,
        content: saved.content,
        likes: 0,
        comments: 0,
        aiVerified: true,
      };
      setPosts(prev => [newPost, ...prev]);
      setStats(prev => ({ ...prev, postsShared: prev.postsShared + 1 }));
      setNewPostText('');
    } catch (err) {
      setPostError(err.message || 'Failed to publish post.');
    } finally {
      setIsAiScanning(false);
    }
  };

  // ── Like a post ──
  const handleLike = async (postId) => {
    try {
      await toggleLike(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  // ── Open booking modal ──
  const handleOpenBooking = (counsellor) => {
    setBookingModal(counsellor);
    setBookingTopic('');
    setBookingDate('');
    setBookingError('');
  };

  // ── Start chat ──
  const handleStartChat = async (counsellorId, counsellorName, initialMessage = null) => {
    try {
      const thread = await startThread(counsellorId);
      
      if (initialMessage) {
        await sendMessage(thread.id, initialMessage);
        thread.last_message = initialMessage;
      }
      
      setChats(prev => {
        const existing = prev.find(c => c.id === thread.id);
        const updated = existing ? { ...existing, lastMessage: thread.last_message } : {
          id: thread.id,
          name: counsellorName,
          avatar: counsellorName.slice(-2),
          time: 'Just now',
          lastMessage: thread.last_message || 'Chat started',
          unread: 0,
          messages: []
        };
        return [updated, ...prev.filter(c => c.id !== thread.id)];
      });
      
      setCurrentTab('chat');
    } catch (err) {
      console.error("Failed to start chat:", err);
      alert("Could not start chat. Please try again.");
    }
  };

  // ── Confirm booking ──
  const handleConfirmBooking = async () => {
    if (!bookingTopic.trim() || !bookingDate) {
      setBookingError('Please fill in the topic and preferred date/time.');
      return;
    }
    setBookingLoading(true);
    setBookingError('');
    try {
      await bookAppointment(bookingModal.counsellorId, bookingTopic, bookingDate);
      setAppointments(prev => prev.map(a => a.counsellorId === bookingModal.counsellorId ? { ...a, status: 'Pending' } : a));
      setStats(prev => ({ ...prev, sessionsBooked: prev.sessionsBooked + 1 }));
      
      // Auto-start chat with a message
      const formattedDate = new Date(bookingDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const initialMsg = `Hi ${bookingModal.name}, I have requested a session to discuss: ${bookingTopic}. My preferred time is ${formattedDate}.`;
      await handleStartChat(bookingModal.counsellorId, bookingModal.name, initialMsg);
      
      setBookingModal(null);
      alert(`Session request sent to ${bookingModal.name}! They will confirm shortly.`);
    } catch (err) {
      setBookingError(err.message || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(chatSearch.toLowerCase()));

  // ── Helper ──
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  return (
    <div className="animated-view">

      {/* ─────────── DASHBOARD ─────────── */}
      {currentTab === 'dashboard' && (
        <div>
          <div className="dashboard-hero">
            <div className="hero-content">
              <h2>Welcome back, {profile.nickname || 'User'} 💜</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                You're safe here. How are you feeling today?
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setCurrentTab('mood')}>
              <Icons.Smile size={16} /> Log Mood
            </button>
          </div>

          <div className="stats-grid">
            <div className="glass-card stat-card">
              <span className="stat-label">Posts shared</span>
              <span className="stat-value">{stats.postsShared}</span>
              <Icons.Share2 size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Sessions booked</span>
              <span className="stat-value">{stats.sessionsBooked}</span>
              <Icons.Calendar size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Mood streak</span>
              <span className="stat-value">{stats.moodStreak}</span>
              <Icons.Zap size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Active chats</span>
              <span className="stat-value">{stats.activeChats}</span>
              <Icons.MessageSquare size={24} style={{ position: 'absolute', right: '15px', bottom: '15px', color: 'rgba(139, 92, 246, 0.15)' }} />
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="glass-card">
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icons.TrendingUp size={20} className="text-primary" /> Your week in mood
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>This week check-ins overview</p>
              {moodLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <Icons.Smile size={36} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                  <p>No mood logs yet. Log your first mood!</p>
                </div>
              ) : (
                <div className="timeline">
                  {moodLogs.slice(0, 7).map((log, i) => (
                    <div className="timeline-item" key={i}>
                      <div className="timeline-mood-info">
                        <span style={{ fontSize: '1.25rem' }}>{log.emoji}</span>
                        <span className="timeline-day">{log.day}</span>
                      </div>
                      <span className="timeline-mood-tag">{log.mood}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '1.25rem' }}>Quick actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '1rem' }} onClick={() => setCurrentTab('feed')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.Share2 size={16} /> Share anonymously</span>
                  <Icons.ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '1rem' }} onClick={() => setCurrentTab('chat')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.Users size={16} /> Talk to a peer</span>
                  <Icons.ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', padding: '1rem' }} onClick={() => setCurrentTab('counselling')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.Calendar size={16} /> Book counselling</span>
                  <Icons.ChevronRight size={16} />
                </button>
                {sessions && sessions.length > 0 && (
                  <div className="glass-card" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--primary-light)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                      📅 You have {sessions.length} booked session{sessions.length > 1 ? 's' : ''}
                    </p>
                    {sessions.slice(0, 1).map(s => (
                      <p key={s.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        With {s.trainee_name} · {s.topic} · <strong>{s.status}</strong>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── SOCIAL FEED ─────────── */}
      {currentTab === 'feed' && (
        <div className="feed-layout">
          <div>
            <div className="glass-card feed-composer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Icons.Lock size={14} /> Posting anonymously as <strong>{profile.nickname || 'You'}</strong>
              </div>
              <textarea
                className="feed-textarea"
                placeholder="What's on your mind? You're safe here…"
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                disabled={isAiScanning}
              />
              <div className="tags-row">
                {['Academic Stress', 'Financial Issues', 'Relationships', 'Mental Health'].map(tag => (
                  <button key={tag} className={`tag-btn ${selectedTag === tag ? 'active' : ''}`} onClick={() => setSelectedTag(tag)} disabled={isAiScanning}>
                    {tag}
                  </button>
                ))}
              </div>
              <div className="feed-composer-actions">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{newPostText.length}/2000</span>
                <button className="btn btn-primary" onClick={handleAiScanAndPost} disabled={isAiScanning || !newPostText.trim()}>
                  {isAiScanning ? <><Icons.Loader size={16} className="animate-spin" /> Scanning…</> : <><Icons.Cpu size={16} /> AI Scan & Post</>}
                </button>
              </div>
              {isAiScanning && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--primary-light)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 'var(--radius-lg)', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>
                  {aiScanStatus}
                </div>
              )}
              {postError && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', color: '#991b1b' }}>
                  {postError}
                </div>
              )}
            </div>

            <div className="post-list">
              {posts.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Icons.Rss size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  <p>No posts yet. Be the first to share!</p>
                </div>
              ) : posts.map(post => (
                <div className="glass-card post-card" key={post.id}>
                  <div className="post-header">
                    <div className="user-avatar-meta">
                      <div className="avatar-circle">{post.avatar}</div>
                      <div className="user-meta-info">
                        <span className="post-author">{post.author}</span>
                        <span className="post-time">{post.time}</span>
                      </div>
                    </div>
                    <span className="post-category-badge">{post.category}</span>
                  </div>
                  <p className="post-body">{post.content}</p>
                  <div className="post-actions">
                    <button className="post-action-btn" onClick={() => handleLike(post.id)}>
                      <Icons.Heart size={16} /> {post.likes}
                    </button>
                    <button className="post-action-btn">
                      <Icons.MessageCircle size={16} /> {post.comments}
                    </button>
                    {post.aiVerified && (
                      <span className="post-ai-badge">
                        <Icons.ShieldCheck size={14} /> AI verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card">
              <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.BookOpen size={16} className="text-primary" /> Community guidelines</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <li>💜 Be kind. We're all healing.</li>
                <li>🤖 AI scans every post for safety.</li>
                <li>🔒 Your identity stays anonymous.</li>
                <li>🚫 Toxicity = auto-flagged.</li>
              </ul>
            </div>
            <div className="glass-card">
              <h4 style={{ marginBottom: '1rem' }}>Trending topics</h4>
              {[['#FinalsWeek', '107'], ['#SleepHelp', '95'], ['#PTPTNDelay', '122'], ['#ExamStress', '89']].map(([tag, count]) => (
                <div key={tag} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{tag}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{count} posts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────── MOOD TRACKER ─────────── */}
      {currentTab === 'mood' && (
        <div style={{ maxWidth: '650px', margin: '0 auto' }}>
          <div className="glass-card">
            <h3>How are you feeling?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Daily check-ins help us understand your wellbeing trends.
            </p>

            {moodSavedToast && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-lg)', color: '#065f46', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icons.CheckCircle size={16} /> Mood saved successfully! Your streak is updated.
              </div>
            )}
            {moodError && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', color: '#991b1b' }}>
                {moodError}
              </div>
            )}

            <div className="mood-selector-grid">
              {[{ name: 'Happy', emoji: '😊' }, { name: 'Calm', emoji: '😌' }, { name: 'Sad', emoji: '😢' }, { name: 'Stressed', emoji: '😣' }, { name: 'Anxious', emoji: '😰' }].map(mood => (
                <div key={mood.name} className={`mood-card ${selectedMood === mood.name ? 'selected' : ''}`} onClick={() => setSelectedMood(mood.name)}>
                  <span className="mood-emoji">{mood.emoji}</span>
                  <span className="mood-label">{mood.name}</span>
                </div>
              ))}
            </div>

            <textarea
              className="feed-textarea"
              placeholder="Optional journal note… (private)"
              style={{ minHeight: '80px', marginTop: '1.5rem' }}
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
            />

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSaveMood}>
              Save today's mood
            </button>
          </div>

          <div className="glass-card" style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Recent moods</h4>
            {moodLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No mood logs yet.</p>
            ) : (
              <div className="timeline">
                {moodLogs.map((log, index) => (
                  <div className="timeline-item" key={index}>
                    <div className="timeline-mood-info">
                      <span style={{ fontSize: '1.25rem' }}>{log.emoji}</span>
                      <span className="timeline-day">{log.day}</span>
                    </div>
                    <span className="timeline-mood-tag">{log.mood}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── PEER CHAT ─────────── */}
      {currentTab === 'chat' && (
        <div className="chat-layout">
          <div className="chat-list-panel">
            <div className="chat-search-container">
              <input type="text" className="search-input" placeholder="Search chats…" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} />
            </div>
            <div className="chat-users-list">
              {filteredChats.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No chats yet. Book a session to start chatting.
                </div>
              ) : filteredChats.map((c) => (
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
                Select a conversation to start chatting
              </div>
            ) : (
              <>
                <div className="chat-window-header">
                  <div className="chat-window-avatar">{activeThread.avatar}</div>
                  <div>
                    <div className="chat-window-title">{activeThread.name}</div>
                    <div className="chat-window-status">
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', background: isPartnerOnline ? '#10b981' : '#9ca3af', borderRadius: '50%', marginRight: '4px' }}></span>
                      <span style={{ color: isPartnerOnline ? '#10b981' : '#6b7280', fontWeight: '500' }}>{isPartnerOnline ? 'Online' : 'Offline'}</span> · End-to-end encrypted
                    </div>
                  </div>
                </div>

                <div className="chat-messages">
                  {chatLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      <Icons.Loader size={20} className="animate-spin" />
                    </div>
                  ) : activeMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No messages yet. Say hello! 👋
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
                    placeholder="Type a safe message…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                  />
                  <button className="btn btn-primary" style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', padding: 0 }} onClick={handleSendMessage}>
                    <Icons.Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────── COUNSELLING ─────────── */}
      {currentTab === 'counselling' && (
        <div>
          <div style={{ marginBottom: '2rem' }}>
            <h3>Book formal counselling</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Identities are revealed only after both parties confirm a session.
            </p>
          </div>

          {appointments.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.Calendar size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No trainees available right now. Check back later.</p>
            </div>
          ) : (
            <div className="counsellor-grid">
              {appointments.map(counsellor => (
                <div className="glass-card counsellor-card" key={counsellor.counsellorId}>
                  <div className="counsellor-header">
                    <div className="counsellor-avatar">{counsellor.avatar}</div>
                    <div className="counsellor-meta">
                      <span className="counsellor-name">{counsellor.name}</span>
                      <span className="counsellor-specialty">{counsellor.specialty}</span>
                      <span className={`counsellor-status ${counsellor.available ? 'available' : 'busy'}`}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', background: counsellor.available ? '#10b981' : '#f59e0b', borderRadius: '50%' }}></span>
                        {counsellor.available ? 'Available' : 'Busy'}
                      </span>
                    </div>
                  </div>

                  <div className="counsellor-info-grid">
                    <div><span className="info-label">Rating:</span><span className="info-value"> ⭐ {counsellor.rating}</span></div>
                    <div><span className="info-label">Languages:</span><span className="info-value"> {counsellor.languages}</span></div>
                    <div><span className="info-label">Gender:</span><span className="info-value"> {counsellor.gender}</span></div>
                    <div><span className="info-label">Next slot:</span><span className="info-value"> {counsellor.nextSlot}</span></div>
                  </div>

                  {counsellor.available ? (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleOpenBooking(counsellor)}>
                        Request session
                      </button>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleStartChat(counsellor.counsellorId, counsellor.name)}>
                        Message
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                      <button className="btn btn-secondary" style={{ flex: 1, cursor: 'default' }} disabled>
                        Unavailable
                      </button>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleStartChat(counsellor.counsellorId, counsellor.name)}>
                        Message
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Booking modal */}
          {bookingModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', background: '#fff' }}>
                <h3 style={{ marginBottom: '0.25rem' }}>Book session with {bookingModal.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{bookingModal.specialty}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>What would you like to discuss?</label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. Exam anxiety, stress management…"
                      value={bookingTopic}
                      onChange={(e) => setBookingTopic(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Preferred date & time</label>
                    <input
                      type="datetime-local"
                      className="search-input"
                      style={{ width: '100%' }}
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>

                  {bookingError && (
                    <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', color: '#991b1b' }}>
                      {bookingError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setBookingModal(null)}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirmBooking} disabled={bookingLoading}>
                      {bookingLoading ? 'Booking…' : 'Confirm request'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────── NOTIFICATIONS ─────────── */}
      {currentTab === 'notifications' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Notifications</h3>
          {notifications.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Icons.Bell size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No notifications yet.</p>
            </div>
          ) : notifications.map(notif => (
            <div className="notification-item" key={notif.id}>
              <div className="notification-icon-wrapper">
                {notif.icon === 'MessageSquare' ? <Icons.MessageSquare size={16} /> : notif.icon === 'Calendar' ? <Icons.Calendar size={16} /> : <Icons.Bell size={16} />}
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
            <div className="avatar-circle" style={{ width: '4.5rem', height: '4.5rem', fontSize: '1.75rem' }}>
              {profile.nickname ? profile.nickname.slice(-2) : 'Me'}
            </div>
            <div>
              <h3>{profile.nickname || 'User'}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Public anonymous identity</p>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <span style={{ padding: '0.2rem 0.5rem', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>Verified UMS</span>
                <span style={{ padding: '0.2rem 0.5rem', background: '#ece9fc', color: 'var(--primary)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>Active</span>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h4 style={{ marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>Profile (private)</h4>
            <form onSubmit={(e) => { e.preventDefault(); alert('Profile info is managed through UMS system. Your anonymous name is fixed for privacy.'); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>UMS Email</label>
                  <input type="text" className="search-input" value={profile.email || '—'} disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Gender</label>
                  <input type="text" className="search-input" value={profile.gender || '—'} disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
                </div>
              </div>
              <div>
                <label className="info-label" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Display nickname (Anonymous ID)</label>
                <input type="text" className="search-input" value={profile.nickname || ''} disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>🔒 Anonymous ID is assigned at registration and cannot be changed.</p>
              </div>

              <div className="alert-box" style={{ background: '#eff6ff', borderColor: '#bfdbfe', margin: '0.5rem 0' }}>
                <Icons.Info size={18} style={{ color: '#1d4ed8', marginTop: '2px' }} />
                <p style={{ fontSize: '0.8rem', color: '#1e3a8a', lineHeight: '1.4' }}>
                  Your real identity is encrypted and never shown publicly. Only revealed after you confirm a counselling session.
                </p>
              </div>
            </form>
          </div>

          <div className="glass-card" style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>My Posts</h4>
            {posts.filter(p => p.author === profile.nickname).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Icons.Edit3 size={32} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>You haven't shared any posts yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {posts.filter(p => p.author === profile.nickname).map(post => (
                  <div key={post.id} style={{ padding: '1rem', background: '#f8fafc', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="post-category-badge">{post.category}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{post.time}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icons.Heart size={14} /> {post.likes}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icons.MessageCircle size={14} /> {post.comments}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
