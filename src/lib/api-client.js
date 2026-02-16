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

  updateStatus: (id, status, remarks) =>
    fetch(`/api/kyc/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, remarks }),
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

  portalValidate: (token) =>
    fetch(`/api/kyc/portal/${token}`).then(handleResponse),

  portalUpload: (token, formData) =>
    fetch(`/api/kyc/portal/${token}/upload`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse),
};
