import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import ItemCard from '../components/ItemCard';
import ItemEditor from '../components/ItemEditor';
import api from '../services/api';
import { getOrCreateUserId } from '../utils/userId';
import { WEAPONS } from '../data/weapons';
import { WEAPON_BONUSES } from '../data/weaponBonuses';
import { WEAPON_TYPES } from '../data/weaponTypes';
import './AdminPage.css';

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showAddByUid, setShowAddByUid] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filterSold, setFilterSold] = useState('');
  const [filterWeapon, setFilterWeapon] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBonus, setFilterBonus] = useState('');
  const navigate = useNavigate();

  const resetAuth = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('apiKey');
    setIsAuthenticated(false);
    setApiKey('');
    setItems([]);
    setError(null);
    navigate('/');
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const storedApiKey = localStorage.getItem('apiKey');
    if (token) {
      setIsAuthenticated(true);
      if (storedApiKey) setApiKey(storedApiKey);
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
      if (err.waitTime) throw { ...err, waitTime: err.waitTime };
      throw err;
    }
  };

  const handleLogout = () => {
    resetAuth();
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMyItems();
      const userId = getOrCreateUserId();
      const itemIds = data.map((item) => item.id);
      const userReactions = await api.getUserReactions(userId, itemIds);
      const itemsWithReactions = data.map((item) => ({
        ...item,
        userReaction: userReactions[item.id] || null,
      }));
      setItems(itemsWithReactions);
    } catch (err) {
      if (err.status === 401) {
        resetAuth();
        return;
      }
      setError(err.message || 'Failed to load your items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReactionUpdate = (updatedItem) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
      )
    );
  };

  const handleEdit = (item) => setEditingItem(item);

  const handleSave = async (itemId, updates) => {
    try {
      await api.updateItem(itemId, updates);
      setEditingItem(null);
      await loadItems();
    } catch (err) {
      if (err.status === 401) {
        resetAuth();
        return;
      }
      throw err;
    }
  };

  const handleCancelEdit = () => setEditingItem(null);

  const handleDelete = async (itemId) => {
    try {
      await api.deleteItem(itemId);
      await loadItems();
    } catch (err) {
      if (err.status === 401) {
        resetAuth();
        return;
      }
      setError(err.message || 'Failed to delete item');
      console.error('Error deleting item:', err);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterSold === 'sold' && !item.isSold) return false;
    if (filterSold === 'notSold' && item.isSold) return false;
    if (filterWeapon && item.name !== filterWeapon) return false;
    if (filterType && item.type !== filterType) return false;
    if (filterBonus) {
      const bonuses = Array.isArray(item.bonuses) ? item.bonuses : [];
      const hasBonus = bonuses.some((b) => b && b.title === filterBonus);
      if (!hasBonus) return false;
    }
    return true;
  });

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1>List your items</h1>
              <p className="subtitle">Manage your listings. Add items by Torn item UID.</p>
            </div>
            <div className="header-actions">
              <Link to="/" className="seller-link back-link">
                Back to search
              </Link>
              <button
                type="button"
                onClick={() => setShowAddByUid(true)}
                className="sync-button"
              >
                Add by UID
              </button>
              <button type="button" onClick={handleLogout} className="logout-button">
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
              <button type="button" onClick={() => setError(null)} className="close-error">
                ×
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading-container">
              <div className="spinner" />
              <p>Loading your items...</p>
            </div>
          ) : (
            <>
              {items.length === 0 ? (
                <div className="empty-state">
                  <p>You have not listed any items. Add items by UID above.</p>
                </div>
              ) : (
                <>
                  <div className="admin-filters">
                    <div className="filters-row">
                      <label className="filter-group">
                        <span>Sold</span>
                        <select
                          value={filterSold}
                          onChange={(e) => setFilterSold(e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All</option>
                          <option value="sold">Sold</option>
                          <option value="notSold">Not sold</option>
                        </select>
                      </label>
                      <label className="filter-group">
                        <span>Weapon</span>
                        <select
                          value={filterWeapon}
                          onChange={(e) => setFilterWeapon(e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All weapons</option>
                          {WEAPONS.map((w) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-group">
                        <span>Type</span>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All types</option>
                          {WEAPON_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-group">
                        <span>Bonus</span>
                        <select
                          value={filterBonus}
                          onChange={(e) => setFilterBonus(e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All bonuses</option>
                          {WEAPON_BONUSES.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="items-header">
                    <h2>Your items ({filteredItems.length}{items.length !== filteredItems.length ? ` of ${items.length}` : ''})</h2>
                  </div>
                  <div className="items-grid">
                    {filteredItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                        isAdmin
                        onReactionUpdate={handleReactionUpdate}
                        onDelete={handleDelete}
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

      {showAddByUid && (
        <AddByUidModal
          onClose={() => setShowAddByUid(false)}
          onSuccess={() => {
            setShowAddByUid(false);
            loadItems();
          }}
          apiKey={apiKey}
          adding={adding}
          setAdding={setAdding}
        />
      )}
    </div>
  );
}

function AddByUidModal({ onClose, onSuccess, apiKey, adding, setAdding }) {
  const [uid, setUid] = useState('');
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    const uidNum = parseInt(uid, 10);
    if (isNaN(uidNum) || uidNum <= 0) {
      setLocalError('Enter a valid item UID (positive number)');
      return;
    }
    const keyToUse = keyInput.trim();
    if (!keyToUse) {
      setLocalError('API key is required to fetch item from Torn');
      return;
    }
    setAdding(true);
    try {
      await api.addByUid(uidNum, keyToUse);
      onSuccess();
    } catch (err) {
      setLocalError(err.message || 'Failed to add item by UID');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="item-editor-overlay">
      <div className="item-editor-modal">
        <div className="item-editor-header">
          <h2>Add item by UID</h2>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="modal-hint">
          Enter the Torn item UID (from your display or inventory). Only weapons with yellow,
          orange, or red quality can be listed. Your API key is used only to fetch the item and is
          not stored.
        </p>
        <form onSubmit={handleSubmit} className="item-editor-form">
          <div className="form-group">
            <label htmlFor="uid">Item UID *</label>
            <input
              type="number"
              id="uid"
              min="1"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="e.g. 12345678"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="apiKey">Torn API key *</label>
            <input
              type="password"
              id="apiKey"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Your API key for this request"
              required
            />
          </div>
          {localError && <div className="error-message">{localError}</div>}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button" disabled={adding}>
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={adding}>
              {adding ? 'Adding...' : 'Fetch and add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminPage;
