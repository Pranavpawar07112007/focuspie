import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';
const api = axios.create({ baseURL: API_BASE });

// ─── Session ──────────────────────────────────────────
export const startSession  = () => api.post('/session/start').then(r => r.data);
export const stopSession   = () => api.post('/session/stop').then(r => r.data);
export const pauseSession  = () => api.post('/session/pause').then(r => r.data);
export const resumeSession = () => api.post('/session/resume').then(r => r.data);
export const sessionStatus = () => api.get('/session/status').then(r => r.data);

// ─── Session History & Granular Details ────────────────
export const getSessions   = () => api.get('/sessions').then(r => r.data);
export const getSession    = (id) => api.get(`/sessions/${id}`).then(r => r.data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`).then(r => r.data);

// ─── Todos ────────────────────────────────────────────
export const getTodos    = () => api.get('/todos').then(r => r.data);
export const createTodo  = (data) => api.post('/todos', data).then(r => r.data);
export const updateTodo  = (id, updates) => api.put(`/todos/${id}`, updates).then(r => r.data);
export const deleteTodo  = (id) => api.delete(`/todos/${id}`).then(r => r.data);

// ─── Insights & AI Forecast ───────────────────────────
export const getInsights = () => api.get('/insights').then(r => r.data);
export const getMlForecast = () => api.get('/ml/predict').then(r => r.data);

// ─── Calendar ─────────────────────────────────────────
export const getCalendar = () => api.get('/calendar').then(r => r.data);

// ─── Live Session Timeline ────────────────────────────
export const getLiveTimeline = () => api.get('/session/live-timeline').then(r => r.data);

// ─── WebSocket ────────────────────────────────────────
export const WS_ALERTS = 'ws://localhost:8000/ws/alerts';
