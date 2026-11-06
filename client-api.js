// Blood Bank Management System - Client API Connector
// Connects to Node.js / MySQL Workbench REST API with automatic local storage fallback

function getApiBaseUrl() {
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return '';
  }
  return 'http://localhost:3000';
}

// Toast notification helper
function showToast(message, type = 'info', callback = null) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span style="font-size: 1.1rem; font-weight: bold;">${icon}</span> <span>${message}</span>`;
  toast.className = `show ${type}`;

  setTimeout(() => {
    toast.className = toast.className.replace('show', '').trim();
    if (callback) callback();
  }, 2200);
}

// Badge Renderers
function renderBloodGroupBadge(bg) {
  return `<span class="badge-blood">🩸 ${bg || 'N/A'}</span>`;
}

function renderStatusBadge(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'eligible') {
    return `<span class="badge badge-eligible"><span class="badge-dot"></span>Eligible</span>`;
  } else if (s.includes('recent') || s.includes('donated')) {
    return `<span class="badge badge-recently-donated"><span class="badge-dot"></span>Recently Donated</span>`;
  } else if (s === 'deferred') {
    return `<span class="badge badge-deferred"><span class="badge-dot"></span>Deferred</span>`;
  } else if (s === 'sufficient') {
    return `<span class="badge badge-sufficient"><span class="badge-dot"></span>Sufficient</span>`;
  } else if (s === 'moderate') {
    return `<span class="badge badge-moderate"><span class="badge-dot"></span>Moderate</span>`;
  } else if (s === 'critical') {
    return `<span class="badge badge-critical"><span class="badge-dot"></span>Critical Shortage</span>`;
  } else if (s === 'approved') {
    return `<span class="badge" style="background:#dbeafe; color:#1e40af;"><span class="badge-dot" style="background:#2563eb;"></span>Approved</span>`;
  } else if (s === 'fulfilled') {
    return `<span class="badge badge-eligible"><span class="badge-dot"></span>Fulfilled</span>`;
  } else if (s === 'pending') {
    return `<span class="badge badge-moderate"><span class="badge-dot"></span>Pending</span>`;
  } else if (s === 'rejected') {
    return `<span class="badge badge-critical"><span class="badge-dot"></span>Rejected</span>`;
  }
  return `<span class="badge" style="background:#e2e8f0; color:#475569;">${status}</span>`;
}

function renderUrgencyBadge(urgency) {
  const u = String(urgency || '').trim().toLowerCase();
  if (u === 'critical') {
    return `<span class="badge badge-urgency-critical">⚠️ CRITICAL</span>`;
  } else if (u === 'urgent') {
    return `<span class="badge badge-urgency-urgent">⚡ Urgent</span>`;
  }
  return `<span class="badge badge-urgency-normal">Standard</span>`;
}

// Live MySQL API Connector Object
const BloodBankAPI = {
  // DB & Server Status
  async getDbStatus() {
    const url = getApiBaseUrl() + '/db-status';
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Could not query /db-status:', e.message);
    }
    return { useMySQL: false, status: 'Local Standalone / Offline Mode' };
  },

  async getStats() {
    const url = getApiBaseUrl() + '/stats';
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Could not query /stats from server, falling back.');
    }
    return null;
  },

  // ------------------------------------------------------------------
  // 1. DONORS API
  // ------------------------------------------------------------------
  async getAllDonors() {
    const url = getApiBaseUrl() + '/donors';
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Failed to connect to MySQL backend server at', url, e);
      showToast('⚠️ Running standalone mode. Run start.bat to sync with MySQL Workbench!', 'info');
    }
    return JSON.parse(localStorage.getItem('bbms_donors') || '[]');
  },

  async getDonorById(id) {
    const url = getApiBaseUrl() + '/donors/' + encodeURIComponent(id);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [data];
      }
    } catch (e) {
      console.error('Failed to fetch donor from backend:', e);
    }
    const donors = JSON.parse(localStorage.getItem('bbms_donors') || '[]');
    return donors.filter(d => String(d.donor_id) === String(id) || String(d.donor_name).toLowerCase().includes(String(id).toLowerCase()));
  },

  async insertDonor(donorData) {
    const url = getApiBaseUrl() + '/donors';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donorData)
      });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      console.error('Error inserting donor to backend:', e);
      // Fallback
      const donors = JSON.parse(localStorage.getItem('bbms_donors') || '[]');
      if (donors.some(d => String(d.donor_id) === String(donorData.donor_id))) {
        return { success: false, message: `Donor ID ${donorData.donor_id} already exists.` };
      }
      donors.push(donorData);
      localStorage.setItem('bbms_donors', JSON.stringify(donors));
      return { success: true, message: 'Donor registered (saved locally).' };
    }
  },

  async updateDonor(id, donorData) {
    const url = getApiBaseUrl() + '/donors/' + encodeURIComponent(id);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donorData)
      });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      console.error('Error updating donor on backend:', e);
      return { success: false, message: 'Could not connect to server. Run start.bat!' };
    }
  },

  async deleteDonor(id) {
    const url = getApiBaseUrl() + '/donors/' + encodeURIComponent(id);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      console.error('Error deleting donor from backend:', e);
      return { success: false, message: 'Could not connect to server. Run start.bat!' };
    }
  },

  // ------------------------------------------------------------------
  // 2. BLOOD_STOCK API
  // ------------------------------------------------------------------
  async getAllStock() {
    const url = getApiBaseUrl() + '/stock';
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Failed to fetch blood stock:', e);
    }
    return [];
  },

  async updateStockUnits(group, units) {
    const url = getApiBaseUrl() + '/stock/' + encodeURIComponent(group);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units: Number(units) })
      });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async adjustStockUnits(group, delta) {
    const url = getApiBaseUrl() + '/stock/adjust';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blood_group: group, delta: Number(delta) })
      });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  // ------------------------------------------------------------------
  // 3. BLOOD_REQUESTS API
  // ------------------------------------------------------------------
  async getAllRequests() {
    const url = getApiBaseUrl() + '/requests';
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Failed to fetch requests:', e);
    }
    return [];
  },

  async getRequestById(id) {
    const url = getApiBaseUrl() + '/requests/' + encodeURIComponent(id);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [data];
      }
    } catch (e) {
      console.error('Failed to fetch request by ID:', e);
    }
    return [];
  },

  async insertRequest(reqData) {
    const url = getApiBaseUrl() + '/requests';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      return { success: false, message: 'Could not connect to server. Run start.bat!' };
    }
  },

  async updateRequestStatus(id, newStatus) {
    const url = getApiBaseUrl() + '/requests/' + encodeURIComponent(id) + '/status';
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus })
      });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      return { success: false, message: 'Could not connect to server.' };
    }
  },

  async deleteRequest(id) {
    const url = getApiBaseUrl() + '/requests/' + encodeURIComponent(id);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const msg = await res.text();
      return { success: res.ok, message: msg };
    } catch (e) {
      return { success: false, message: 'Could not connect to server.' };
    }
  }
};
