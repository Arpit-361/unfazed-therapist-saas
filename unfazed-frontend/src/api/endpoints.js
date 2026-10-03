import api from './axiosInstance';

const data = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (body) => data(api.post('/auth/register', body)),
  login: (body) => data(api.post('/auth/login', body)),
  clientLogin: (body) => data(api.post('/auth/client/login', body)),
  clientRegister: (body) => data(api.post('/auth/client/register', body)),
  getInvite: (token) => data(api.get(`/auth/invite/${token}`)),
  acceptInvite: (token, body) => data(api.post(`/auth/invite/${token}/accept`, body)),
  me: () => data(api.get('/auth/me', { skipAuthRedirect: true })),
};

export const systemApi = {
  health: () => data(api.get('/health')),
  paymentConfig: () => data(api.get('/public/payments/config')),
};

export const publicApi = {
  profile: (slug) => data(api.get(`/public/therapists/${slug}`)),
  slots: (slug, params) => data(api.get(`/public/therapists/${slug}/slots`, { params })),
  enquire: (slug, body) => data(api.post(`/public/therapists/${slug}/enquiries`, body)),
  directoryEnquiry: (body) => data(api.post('/public/leads', body)),
};

export const therapistApi = {
  me: () => data(api.get('/therapists/me')),
  update: (body) => data(api.put('/therapists/me', body)),
  checkSlug: (slug) => data(api.get('/therapists/slug-available', { params: { slug } })),
  intakeForm: () => data(api.get('/therapists/me/intake-form')),
  updateIntakeForm: (fields) => data(api.put('/therapists/me/intake-form', { fields })),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return data(api.post('/therapists/me/photo', form));
  },
};

export const clientsApi = {
  list: (params) => data(api.get('/clients', { params })),
  create: (body) => data(api.post('/clients', body)),
  get: (id) => data(api.get(`/clients/${id}`)),
  update: (id, body) => data(api.put(`/clients/${id}`, body)),
  resendInvite: (id) => data(api.post(`/clients/${id}/invite`)),
};

export const schedulingApi = {
  availability: () => data(api.get('/scheduling/availability')),
  updateAvailability: (body) => data(api.put('/scheduling/availability', body)),
  addBlock: (body) => data(api.post('/scheduling/availability/blocked', body)),
  removeBlock: (id) => data(api.delete(`/scheduling/availability/blocked/${id}`)),
  slots: (params) => data(api.get('/scheduling/slots', { params })),
  sessions: (params) => data(api.get('/scheduling/sessions', { params })),
  createSession: (body) => data(api.post('/scheduling/sessions', body)),
  updateStatus: (id, body) => data(api.patch(`/scheduling/sessions/${id}/status`, body)),
  waitlist: () => data(api.get('/scheduling/waitlist')),
};

export const paymentsApi = {
  list: (params) => data(api.get('/payments', { params })),
  summary: () => data(api.get('/payments/summary')),
  packages: () => data(api.get('/payments/packages')),
  createPackage: (body) => data(api.post('/payments/packages', body)),
  updatePackage: (id, body) => data(api.put(`/payments/packages/${id}`, body)),
  clientPackages: () => data(api.get('/payments/client-packages')),
  invoice: (id) => api.get(`/payments/${id}/invoice`, { responseType: 'blob' }),
};

export const notesApi = {
  list: (params) => data(api.get('/notes', { params })),
  create: (body) => data(api.post('/notes', body)),
  update: (id, body) => data(api.put(`/notes/${id}`, body)),
  remove: (id) => data(api.delete(`/notes/${id}`)),
};

export const analyticsApi = {
  overview: () => data(api.get('/analytics/overview')),
  advanced: () => data(api.get('/analytics/advanced')),
};

export const chatApi = {
  conversations: () => data(api.get('/chat/conversations')),
  messages: (clientId) => data(api.get(`/chat/conversations/${clientId}/messages`)),
  send: (clientId, body) => data(api.post(`/chat/conversations/${clientId}/messages`, { body })),
};

export const leadsApi = {
  list: (params) => data(api.get('/leads', { params })),
  update: (id, body) => data(api.patch(`/leads/${id}`, body)),
  convert: (id) => data(api.post(`/leads/${id}/convert`)),
};

export const entitlementsApi = {
  mine: () => data(api.get('/entitlements')),
  tiers: () => data(api.get('/entitlements/tiers')),
  changeTier: (tier) => data(api.post('/entitlements/change-tier', { tier })),
};

export const notificationsApi = {
  list: () => data(api.get('/notifications')),
  readAll: () => data(api.patch('/notifications/read-all')),
  read: (id) => data(api.patch(`/notifications/${id}/read`)),
};

export const portalApi = {
  me: () => data(api.get('/portal/me')),
  updateProfile: (body) => data(api.put('/portal/me', body)),
  submitIntake: (body) => data(api.put('/portal/intake', body)),
  consentText: () => data(api.get('/portal/consent')),
  giveConsent: (body) => data(api.post('/portal/consent', body)),
  slots: (params) => data(api.get('/portal/slots', { params })),
  sessions: () => data(api.get('/portal/sessions')),
  book: (body) => data(api.post('/portal/sessions', body)),
  cancel: (id) => data(api.post(`/portal/sessions/${id}/cancel`)),
  joinWaitlist: (date) => data(api.post('/portal/waitlist', { date })),
  packages: () => data(api.get('/portal/packages')),
  purchasePackage: (id) => data(api.post(`/portal/packages/${id}/purchase`)),
  payments: () => data(api.get('/portal/payments')),
  retryCheckout: (paymentId) => data(api.post(`/portal/payments/${paymentId}/checkout`)),
  verifyPayment: (body) => data(api.post('/portal/payments/verify', body)),
  demoComplete: (paymentId, outcome) => data(api.post(`/portal/payments/${paymentId}/demo-complete`, { outcome })),
  invoice: (id) => api.get(`/portal/payments/${id}/invoice`, { responseType: 'blob' }),
  notes: () => data(api.get('/portal/notes')),
  messages: () => data(api.get('/portal/messages')),
  sendMessage: (body) => data(api.post('/portal/messages', { body })),
};
