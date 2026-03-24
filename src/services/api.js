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
        error.status = response.status;
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

  async getSellers() {
    return this.request('/.netlify/functions/get-sellers');
  }

  async searchItems(params = {}) {
    const sp = new URLSearchParams();
    if (params.sort != null) sp.set('sort', params.sort);
    if (params.order != null) sp.set('order', params.order);
    if (params.minPrice != null) sp.set('minPrice', params.minPrice);
    if (params.maxPrice != null) sp.set('maxPrice', params.maxPrice);
    if (params.minQuality != null) sp.set('minQuality', params.minQuality);
    if (params.minDamage != null) sp.set('minDamage', params.minDamage);
    if (params.minAccuracy != null) sp.set('minAccuracy', params.minAccuracy);
    if (params.weapon != null && params.weapon !== '') sp.set('weapon', params.weapon);
    if (params.bonus != null && params.bonus !== '') sp.set('bonus', params.bonus);
    if (params.type != null && params.type !== '') sp.set('type', params.type);
    if (params.seller != null && params.seller !== '') sp.set('seller', params.seller);
    if (params.limit != null) sp.set('limit', params.limit);
    if (params.offset != null) sp.set('offset', params.offset);
    const qs = sp.toString();
    return this.request(`/.netlify/functions/get-items${qs ? `?${qs}` : ''}`);
  }

  async getAuctionSold(params = {}) {
    const sp = new URLSearchParams();
    if (params.weapon != null && params.weapon !== '') sp.set('weapon', params.weapon);
    if (params.bonus != null && params.bonus !== '') sp.set('bonus', params.bonus);
    if (params.minBonusValue != null && params.minBonusValue !== '') {
      sp.set('minBonusValue', params.minBonusValue);
    }
    if (params.maxBonusValue != null && params.maxBonusValue !== '') {
      sp.set('maxBonusValue', params.maxBonusValue);
    }
    if (params.limit != null) sp.set('limit', params.limit);
    if (params.offset != null) sp.set('offset', params.offset);
    const qs = sp.toString();
    return this.request(`/.netlify/functions/get-auction-sold${qs ? `?${qs}` : ''}`);
  }

  async getMyItems() {
    return this.request('/.netlify/functions/get-my-items');
  }

  async addByUid(uid, apiKey) {
    return this.request('/.netlify/functions/add-by-uid', {
      method: 'POST',
      body: JSON.stringify({ uid, apiKey }),
    });
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

  async saveCardImage(itemId, imageBase64) {
    return this.request('/.netlify/functions/save-card-image', {
      method: 'POST',
      body: JSON.stringify({ itemId, image: imageBase64 }),
    });
  }
}

export default new ApiService();
