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

      {(item.damage !== null && item.damage !== undefined) ||
       (item.accuracy !== null && item.accuracy !== undefined) ||
       (item.armor !== null && item.armor !== undefined) ||
       (item.quality !== null && item.quality !== undefined) ? (
        <div className="item-stats">
          <h4 className="stats-title">Stats</h4>
          <div className="stats-grid">
            {item.damage !== null && item.damage !== undefined && (
              <div className="stat">
                <span className="stat-label">Damage:</span>
                <span className="stat-value">{item.damage.toFixed(2)}</span>
              </div>
            )}
            {item.accuracy !== null && item.accuracy !== undefined && (
              <div className="stat">
                <span className="stat-label">Accuracy:</span>
                <span className="stat-value">{item.accuracy.toFixed(2)}</span>
              </div>
            )}
            {item.armor !== null && item.armor !== undefined && (
              <div className="stat">
                <span className="stat-label">Armor:</span>
                <span className="stat-value">{item.armor.toFixed(2)}</span>
              </div>
            )}
            {item.quality !== null && item.quality !== undefined && (
              <div className="stat">
                <span className="stat-label">Quality:</span>
                <span className="stat-value">{item.quality.toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {(() => {
        let bonuses = [];
        if (item.bonuses) {
          try {
            bonuses = Array.isArray(item.bonuses) 
              ? item.bonuses 
              : (typeof item.bonuses === 'string' ? JSON.parse(item.bonuses) : item.bonuses);
            if (!Array.isArray(bonuses)) bonuses = [];
          } catch (e) {
            bonuses = [];
          }
        }
        
        return bonuses.length > 0 ? (
          <div className="item-bonuses">
            <h4 className="bonuses-title">Bonuses</h4>
            <div className="bonuses-list">
              {bonuses.map((bonus, index) => (
                <div key={index} className="bonus-item">
                  <div className="bonus-header">
                    <span className="bonus-title">{bonus.title}</span>
                    {bonus.value !== null && bonus.value !== undefined && (
                      <span className="bonus-value">{bonus.value}%</span>
                    )}
                  </div>
                  {bonus.description && (
                    <p className="bonus-description">{bonus.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

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
