const API_BASE = process.env.REACT_APP_API_BASE || '';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
        if (data.waitTime) {
          error.waitTime = data.waitTime;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getItems() {
    return this.request('/.netlify/functions/get-items');
  }

  async syncItems(apiKey) {
    return this.request(`/.netlify/functions/sync-items?key=${encodeURIComponent(apiKey)}`);
  }

  async login(apiKey) {
    return this.request('/.netlify/functions/auth-login', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  }

  async updateItem(itemId, updates) {
    return this.request(`/.netlify/functions/update-item?id=${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async reactToItem(itemId, reaction, userId) {
    return this.request('/.netlify/functions/react-item', {
      method: 'POST',
      body: JSON.stringify({ itemId, reaction, userId }),
    });
  }

  async getUserReactions(userId, itemIds = null) {
    return this.request('/.netlify/functions/get-user-reactions', {
      method: 'POST',
      body: JSON.stringify({ userId, itemIds }),
    });
  }

  async deleteItem(itemId) {
    return this.request(`/.netlify/functions/delete-item?id=${itemId}`, {
      method: 'DELETE',
    });
  }
}

export default new ApiService();
