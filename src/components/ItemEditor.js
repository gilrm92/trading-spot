import React, { useState } from 'react';
import './ItemEditor.css';

function ItemEditor({ item, onSave, onCancel }) {
  const [myDescription, setMyDescription] = useState(item.myDescription || '');
  const [myPrice, setMyPrice] = useState(item.myPrice || '');
  const [likes, setLikes] = useState(item.likes || 0);
  const [dislikes, setDislikes] = useState(item.dislikes || 0);
  const [heatUps, setHeatUps] = useState(item.heatUps || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const updates = {};
      if (myDescription !== (item.myDescription || '')) {
        updates.myDescription = myDescription;
      }
      if (myPrice !== (item.myPrice || '')) {
        updates.myPrice = myPrice === '' ? null : parseInt(myPrice);
      }
      if (likes !== (item.likes || 0)) {
        updates.likes = parseInt(likes);
      }
      if (dislikes !== (item.dislikes || 0)) {
        updates.dislikes = parseInt(dislikes);
      }
      if (heatUps !== (item.heatUps || 0)) {
        updates.heatUps = parseInt(heatUps);
      }

      await onSave(item.id, updates);
    } catch (err) {
      setError(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="item-editor-overlay">
      <div className="item-editor-modal">
        <div className="item-editor-header">
          <h2>Edit {item.name}</h2>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="item-editor-form">
          <div className="form-group">
            <label htmlFor="description">My Description</label>
            <textarea
              id="description"
              value={myDescription}
              onChange={(e) => setMyDescription(e.target.value)}
              placeholder="Enter your description..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">My Price</label>
            <input
              type="number"
              id="price"
              value={myPrice}
              onChange={(e) => setMyPrice(e.target.value)}
              placeholder="Enter your price..."
              min="0"
            />
          </div>

          <div className="form-group">
            <label>Reaction Counts</label>
            <div className="reaction-counts">
              <div className="reaction-count-input">
                <label htmlFor="likes">Likes:</label>
                <input
                  type="number"
                  id="likes"
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  min="0"
                />
              </div>
              <div className="reaction-count-input">
                <label htmlFor="dislikes">Dislikes:</label>
                <input
                  type="number"
                  id="dislikes"
                  value={dislikes}
                  onChange={(e) => setDislikes(e.target.value)}
                  min="0"
                />
              </div>
              <div className="reaction-count-input">
                <label htmlFor="heatUps">Heat Ups:</label>
                <input
                  type="number"
                  id="heatUps"
                  value={heatUps}
                  onChange={(e) => setHeatUps(e.target.value)}
                  min="0"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-button"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ItemEditor;
