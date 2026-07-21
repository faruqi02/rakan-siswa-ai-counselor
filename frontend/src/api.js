/**
 * api.js — Central API client for Rakan Siswa frontend.
 * All requests attach the JWT token from sessionStorage automatically.
 */

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function getToken() {
  return sessionStorage.getItem('rs_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const url = `${BASE.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, opts);

  // 204 No Content — return null
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.detail) || `API error ${res.status}`);
  }
  return data;
}

const get  = (path)         => request('GET',   path);
const post = (path, body)   => request('POST',  path, body);
const patch= (path, body)   => request('PATCH', path, body);

// ─────────────────────────── POSTS ───────────────────────────

export const fetchPosts          = (category) =>
  get(`/posts/${category ? `?category=${encodeURIComponent(category)}` : ''}`);

export const createPost          = (category, content) =>
  post('/posts/', { category, content });

export const toggleLike          = (postId) =>
  post(`/posts/${postId}/like`);

// ─────────────────────────── MOOD ───────────────────────────

export const fetchMoodLogs       = () => get('/mood/');
export const logMood             = (mood, emoji, note) =>
  post('/mood/', { mood, emoji, note });

// ─────────────────────────── CHAT ───────────────────────────

export const fetchChats          = () => get('/chats/');
export const fetchMessages       = (threadId) => get(`/chats/${threadId}/messages`);
export const sendMessage         = (threadId, content) =>
  post(`/chats/${threadId}/messages`, { content });
export const startThread         = (partnerId) =>
  post(`/chats/start/${partnerId}`);

// ─────────────────────────── USERS / TRAINEES ───────────────────────────

export const fetchMe             = () => get('/users/me');
export const fetchTrainees       = () => get('/users/trainees');
export const fetchAllUsers       = () => get('/users/');
export const fetchUserStatus     = (name) => get(`/users/${encodeURIComponent(name)}/status`);
export const updateUserStatus    = (userId, status) =>
  patch(`/users/${userId}/status`, { status });
export const updateUserDetails   = (userId, data) =>
  patch(`/users/${userId}`, data);
export const updateTraineeProfile = (updates) =>
  patch('/users/trainees/me', updates);

// ─────────────────────────── APPOINTMENTS ───────────────────────────

export const fetchAppointments   = () => get('/appointments/');
export const bookAppointment     = (traineeId, topic, scheduledAt, durationMin = 45) =>
  post('/appointments/', { trainee_id: traineeId, topic, scheduled_at: scheduledAt, duration_min: durationMin });
export const updateAppointment   = (aptId, status, studentRating, notes) =>
  patch(`/appointments/${aptId}`, { status, student_rating: studentRating, notes });

// ─────────────────────────── NOTIFICATIONS ───────────────────────────

export const fetchNotifications  = () => get('/notifications/');
export const markNotifRead       = (id) => patch(`/notifications/${id}/read`);
export const markAllNotifsRead   = () => patch('/notifications/read-all');

// ─────────────────────────── ADMIN — MODERATION ───────────────────────────

export const fetchFlaggedPosts   = () => get('/moderation/flagged');
export const moderatePost        = (flagId, action, reason) =>
  patch(`/moderation/flagged/${flagId}`, { action, reason });
export const manualFlag          = (postId, score) =>
  post(`/moderation/flag/${postId}?toxicity_score=${score}`);

// ─────────────────────────── ADMIN — ANALYTICS ───────────────────────────

export const fetchAnalyticsSummary = () => get('/analytics/summary');
export const fetchSystemLogs       = (limit = 50) => get(`/analytics/logs?limit=${limit}`);
