function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const authApi = {
  login: (email, password) =>
    fetch('/api/auth/login', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    }).then(handleResponse),
};

export const sheetsApi = {
  syncAll: () =>
    fetch('/api/sync-sheets', { method: 'POST', headers: getHeaders() }).then(handleResponse),
};

export const kycApi = {
  stats: () =>
    fetch('/api/kyc/stats', { headers: getHeaders() }).then(handleResponse),

  list: () =>
    fetch('/api/kyc/list', { headers: getHeaders() }).then(handleResponse),

  create: (data) =>
    fetch('/api/kyc/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  getDocs: (id) =>
    fetch(`/api/kyc/${id}/docs`, { headers: getHeaders() }).then(handleResponse),

  updateStatus: (id, status, remarks, pepStatus, pepDetails) =>
    fetch(`/api/kyc/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, remarks, pepStatus, pepDetails }),
    }).then(handleResponse),

  downloadFile: async (fileId, fileName) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(`/api/kyc/doc/download/${fileId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getFormData: (id) =>
    fetch(`/api/kyc/${id}/form`, { headers: getHeaders() }).then(handleResponse),

  exportPdf: async (id) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(`/api/kyc/${id}/export-pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('PDF export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KYC-Export-${id.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getComplianceResults: (id) =>
    fetch(`/api/kyc/${id}/compliance-check`, { headers: getHeaders() }).then(handleResponse),

  runComplianceCheck: (id) =>
    fetch(`/api/kyc/${id}/compliance-check`, {
      method: 'POST',
      headers: getHeaders(),
    }).then(handleResponse),

  overrideCompliance: (id, checkKey, adminOverride, adminNotes) =>
    fetch(`/api/kyc/${id}/compliance-override`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ checkKey, adminOverride, adminNotes }),
    }).then(handleResponse),

  sapPush: (id, bpType) =>
    fetch(`/api/kyc/${id}/sap-push`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ bpType }),
    }).then(handleResponse),

  portalValidate: (token) =>
    fetch(`/api/kyc/portal/${token}`).then(handleResponse),

  portalGetForm: (token) =>
    fetch(`/api/kyc/portal/${token}/form`).then(handleResponse),

  portalSaveForm: (token, formData) =>
    fetch(`/api/kyc/portal/${token}/form`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData }),
    }).then(handleResponse),

  portalUpload: (token, formData) =>
    fetch(`/api/kyc/portal/${token}/upload`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse),
};
