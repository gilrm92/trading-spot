import React from 'react';
import './ItemCard.css';

function ItemCard({ item, onEdit, isAdmin = false }) {
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US').format(price);
  };

  const getRarityColor = (rarity) => {
    const colors = {
      yellow: '#ffd700',
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      purple: '#aa44ff',
    };
    return colors[rarity] || '#888';
  };

  return (
    <div className="item-card">
      <div className="item-header">
        <h3 className="item-name">{item.name}</h3>
        {item.rarity && (
          <span
            className="item-rarity"
            style={{ color: getRarityColor(item.rarity) }}
          >
            {item.rarity}
          </span>
        )}
      </div>

      <div className="item-info">
        <div className="info-row">
          <span className="info-label">Type:</span>
          <span className="info-value">{item.type}</span>
        </div>
        {item.subType && (
          <div className="info-row">
            <span className="info-label">Sub Type:</span>
            <span className="info-value">{item.subType}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Market Price:</span>
          <span className="info-value">${formatPrice(item.marketPrice)}</span>
        </div>
        {item.myPrice !== null && item.myPrice !== undefined && (
          <div className="info-row highlight">
            <span className="info-label">My Price:</span>
            <span className="info-value">${formatPrice(item.myPrice)}</span>
          </div>
        )}
        {item.quantity > 0 && (
          <div className="info-row">
            <span className="info-label">Quantity:</span>
            <span className="info-value">{item.quantity}</span>
          </div>
        )}
      </div>

      {item.stats && (
        <div className="item-stats">
          {item.damage && (
            <div className="stat">
              <span className="stat-label">Damage:</span>
              <span className="stat-value">{item.damage.toFixed(2)}</span>
            </div>
          )}
          {item.accuracy && (
            <div className="stat">
              <span className="stat-label">Accuracy:</span>
              <span className="stat-value">{item.accuracy.toFixed(2)}</span>
            </div>
          )}
          {item.quality && (
            <div className="stat">
              <span className="stat-label">Quality:</span>
              <span className="stat-value">{item.quality.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {item.myDescription && (
        <div className="item-description">
          <p>{item.myDescription}</p>
        </div>
      )}

      {isAdmin && onEdit && (
        <button className="edit-button" onClick={() => onEdit(item)}>
          Edit
        </button>
      )}
    </div>
  );
}

export default ItemCard;
