import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import ItemCard from '../components/ItemCard';
import ItemEditor from '../components/ItemEditor';
import api from '../services/api';
import { getOrCreateUserId } from '../utils/userId';
import './AdminPage.css';

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('authToken');
    const storedApiKey = localStorage.getItem('apiKey');
    if (token && storedApiKey) {
      setIsAuthenticated(true);
      setApiKey(storedApiKey);
      loadItems();
    }
  }, []);

  const handleLogin = async (key) => {
    try {
      const response = await api.login(key);
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('apiKey', key);
      setApiKey(key);
      setIsAuthenticated(true);
      await loadItems();
    } catch (err) {
      if (err.waitTime) {
        throw { ...err, waitTime: err.waitTime };
      }
      throw err;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('apiKey');
    setIsAuthenticated(false);
    setApiKey('');
    setItems([]);
    navigate('/');
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getItems();
      
      // Load user reactions
      const userId = getOrCreateUserId();
      const itemIds = data.map(item => item.id);
      const userReactions = await api.getUserReactions(userId, itemIds);
      
      // Attach user reactions to items
      const itemsWithReactions = data.map(item => ({
        ...item,
        userReaction: userReactions[item.id] || null
      }));
      
      setItems(itemsWithReactions);
    } catch (err) {
      setError(err.message || 'Failed to load items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReactionUpdate = (updatedItem) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
      )
    );
  };

  const handleSync = async () => {
    if (!apiKey) {
      setError('API key is required for syncing');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      const result = await api.syncItems(apiKey);
      await loadItems();
      alert(`Sync completed! Created: ${result.created}, Updated: ${result.updated}, Removed: ${result.removed}`);
    } catch (err) {
      setError(err.message || 'Failed to sync items');
      console.error('Error syncing items:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
  };

  const handleSave = async (itemId, updates) => {
    try {
      await api.updateItem(itemId, updates);
      setEditingItem(null);
      await loadItems();
    } catch (err) {
      throw err;
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1>Admin Panel</h1>
              <p className="subtitle">Manage your items</p>
            </div>
            <div className="header-actions">
              <button
                onClick={handleSync}
                className="sync-button"
                disabled={syncing || !apiKey}
              >
                {syncing ? 'Syncing...' : 'Sync Items'}
              </button>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="admin-content">
        <div className="container">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="close-error">×</button>
            </div>
          )}

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading items...</p>
            </div>
          ) : (
            <>
              {items.length === 0 ? (
                <div className="empty-state">
                  <p>No items available. Click "Sync Items" to fetch from Torn API.</p>
                </div>
              ) : (
                <>
                  <div className="items-header">
                    <h2>Items ({items.length})</h2>
                  </div>
                  <div className="items-grid">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                        isAdmin={true}
                        onReactionUpdate={handleReactionUpdate}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {editingItem && (
        <ItemEditor
          item={editingItem}
          onSave={handleSave}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

export default AdminPage;
