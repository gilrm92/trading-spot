import React, { useState, useEffect } from 'react';
import ItemCard from '../components/ItemCard';
import api from '../services/api';
import { getOrCreateUserId } from '../utils/userId';
import './PublicPage.css';

function PublicPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadItems();
  }, []);

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

  if (loading) {
    return (
      <div className="public-page">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading items...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-page">
        <div className="container">
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={loadItems} className="retry-button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page">
      <header className="page-header">
        <div className="container">
          <h1>Torn Trading Spot</h1>
          <p className="subtitle">Browse available items</p>
        </div>
      </header>

      <main className="page-content">
        <div className="container">
          {items.length === 0 ? (
            <div className="empty-state">
              <p>No items available at the moment.</p>
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
                    onReactionUpdate={handleReactionUpdate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default PublicPage;
