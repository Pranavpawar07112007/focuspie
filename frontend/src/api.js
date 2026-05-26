import axios from 'axios';

// ─── Base URL Configuration ──────────────────────────────────────────
// Detect Electron environment and use localhost
const HOST = window.location.hostname || 'localhost';
const API_BASE = `http://${HOST}:8000/api`;

const api = axios.create({ baseURL: API_BASE });

// ─── Auth Interceptors ──────────────────────────────────────────────

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('focuspie_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('focuspie_token');
      localStorage.removeItem('focuspie_user');
      // Dispatch event so AuthContext can react
      window.dispatchEvent(new Event('auth-logout'));
    }
    return Promise.reject(error);
  }
);


// ─── Auth ─────────────────────────────────────────────────────────────
export const signup   = (data) => api.post('/auth/signup', data).then(r => r.data);
export const login    = (data) => api.post('/auth/login', data).then(r => r.data);
export const getMe    = ()     => api.get('/auth/me').then(r => r.data);

// ─── Settings ─────────────────────────────────────────────────────────
export const getSettings    = ()       => api.get('/settings').then(r => r.data);
export const updateSettings = (data)   => api.put('/settings', data).then(r => r.data);

// ─── Data Management ──────────────────────────────────────────────────
export const exportData = (format = 'json') =>
  api.get(`/data/export?format=${format}`, { responseType: 'blob' }).then(r => r.data);
export const deleteAccount = () => api.delete('/data/delete-account').then(r => r.data);

// ─── Health Check ─────────────────────────────────────────────────────
export const checkHealth = () => api.get('/health').then(r => r.data);

// ─── Session ──────────────────────────────────────────────────────────
export const startSession  = (data) => api.post('/session/start', data).then(r => r.data);
export const stopSession   = () => api.post('/session/stop').then(r => r.data);
export const pauseSession  = () => api.post('/session/pause').then(r => r.data);
export const resumeSession = () => api.post('/session/resume').then(r => r.data);
export const sessionStatus = () => api.get('/session/status').then(r => r.data);

// ─── Session History & Granular Details ───────────────────────────────
export const getSessions   = () => api.get('/sessions').then(r => r.data);
export const getSession    = (id) => api.get(`/sessions/${id}`).then(r => r.data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`).then(r => r.data);

// ─── Todos ────────────────────────────────────────────────────────────
export const getTodos    = () => api.get('/todos').then(r => r.data);
export const createTodo  = (data) => api.post('/todos', data).then(r => r.data);
export const updateTodo  = (id, updates) => api.put(`/todos/${id}`, updates).then(r => r.data);
export const deleteTodo  = (id) => api.delete(`/todos/${id}`).then(r => r.data);

// ─── Insights & AI Forecast ──────────────────────────────────────────
export const getInsights = (range = 'today') => api.get(`/insights?range=${range}`).then(r => r.data);
export const getMlForecast = () => api.get('/ml/predict').then(r => r.data);

// ─── Calendar ─────────────────────────────────────────────────────────
export const getCalendar = () => api.get('/calendar').then(r => r.data);

// ─── Live Session Timeline ───────────────────────────────────────────
export const getLiveTimeline = () => api.get('/session/live-timeline').then(r => r.data);

// ─── WebSocket ────────────────────────────────────────────────────────
export const WS_ALERTS = `ws://${HOST}:8000/ws/alerts`;
export const WS_ROOMS = `ws://${HOST}:8000/ws/rooms`;

// ─── Rooms ────────────────────────────────────────────────────────────
export const createRoom  = (data) => api.post('/rooms', data).then(r => r.data);
export const joinRoom    = (data) => api.post('/rooms/join', data).then(r => r.data);
export const getRooms    = ()     => api.get('/rooms').then(r => r.data);
export const getRoom     = (id)   => api.get(`/rooms/${id}`).then(r => r.data);
export const leaveRoom   = (id)   => api.delete(`/rooms/${id}/leave`).then(r => r.data);
export const deleteRoom  = (id)   => api.delete(`/rooms/${id}`).then(r => r.data);
export const kickMember  = (roomId, userId) => api.delete(`/rooms/${roomId}/members/${userId}`).then(r => r.data);
export const getRoomInsights = (id) => api.get(`/rooms/${id}/insights`).then(r => r.data);

