import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ItemCard from '../components/ItemCard';
import api from '../services/api';
import { getOrCreateUserId } from '../utils/userId';
import { WEAPONS } from '../data/weapons';
import { WEAPON_BONUSES } from '../data/weaponBonuses';
import { WEAPON_TYPES } from '../data/weaponTypes';
import { WEAPON_TYPE_MAP } from '../data/weaponTypesMap';
import './PublicPage.css';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'quality', label: 'Quality' },
  { value: 'damage', label: 'Damage' },
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'createdAt', label: 'Date listed' },
];

const PAGE_SIZE = 24;

function PublicPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minQuality, setMinQuality] = useState('');
  const [minDamage, setMinDamage] = useState('');
  const [minAccuracy, setMinAccuracy] = useState('');
  const [type, setType] = useState('');
  const [weapon, setWeapon] = useState('');
  const [bonus, setBonus] = useState('');
  const [searchParams] = useSearchParams();
  const [seller, setSeller] = useState(() => searchParams.get('seller') || '');
  const [offset, setOffset] = useState(0);

  const loadItems = useCallback(async (append = false, fetchOffset = 0) => {
    const currentOffset = append ? fetchOffset : 0;
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const params = {
        sort,
        order,
        limit: PAGE_SIZE,
        offset: currentOffset,
      };
      if (minPrice !== '') params.minPrice = minPrice;
      if (maxPrice !== '') params.maxPrice = maxPrice;
      if (minQuality !== '') params.minQuality = minQuality;
      if (minDamage !== '') params.minDamage = minDamage;
      if (minAccuracy !== '') params.minAccuracy = minAccuracy;
      if (type) params.type = type;
      if (weapon) params.weapon = weapon;
      if (bonus) params.bonus = bonus;
      if (seller) params.seller = seller;

      const data = await api.searchItems(params);

      const userId = getOrCreateUserId();
      const itemIds = data.map((item) => item.id);
      const userReactions = itemIds.length > 0 ? await api.getUserReactions(userId, itemIds) : {};

      const itemsWithReactions = data.map((item) => ({
        ...item,
        userReaction: userReactions[item.id] || null,
      }));

      if (append) {
        setItems((prev) => [...prev, ...itemsWithReactions]);
        setOffset(currentOffset + data.length);
      } else {
        setItems(itemsWithReactions);
        setOffset(data.length);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError(err.message || 'Failed to load items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort, order, minPrice, maxPrice, minQuality, minDamage, minAccuracy, type, weapon, bonus, seller]);

  const handleLoadMore = () => {
    loadItems(true, offset);
  };

  // Sync seller from URL when it changes (e.g. user opens share link)
  useEffect(() => {
    const sellerFromUrl = searchParams.get('seller') || '';
    setSeller(sellerFromUrl);
  }, [searchParams]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleReactionUpdate = (updatedItem) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
      )
    );
  };

  const initialLoad = loading && items.length === 0;

  return (
    <div className="public-page">
      <header className="page-header">
        <div className="container">
          <div className="header-row">
            <h1>Torn Trading Hub</h1>
            <Link to="/list" className="seller-link">
              List your items
            </Link>
          </div>
          <div className="header-content">
            <p className="header-message">
              This is a space to list and search for RW Weapons without risks. Send a message to CrowleyJr if you have any questions.
            </p>
          </div>
        </div>
      </header>

      <main className="page-content">
        <div className="container">
          <div className="search-toolbar">
            <div className="filters-row">
              <label className="filter-group">
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="filter-select"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-group">
                <span>Order</span>
                <select
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  className="filter-select"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
              <label className="filter-group">
                <span>Min price</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="filter-input"
                />
              </label>
              <label className="filter-group">
                <span>Max price</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="filter-input"
                />
              </label>
              <label className="filter-group">
                <span>Min quality</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={minQuality}
                  onChange={(e) => setMinQuality(e.target.value)}
                  className="filter-input"
                />
              </label>
              <label className="filter-group">
                <span>Min damage</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={minDamage}
                  onChange={(e) => setMinDamage(e.target.value)}
                  className="filter-input"
                />
              </label>
              <label className="filter-group">
                <span>Min accuracy</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={minAccuracy}
                  onChange={(e) => setMinAccuracy(e.target.value)}
                  className="filter-input"
                />
              </label>
              <label className="filter-group">
                <span>Type</span>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setType(newType);
                    if (newType && weapon && WEAPON_TYPE_MAP[weapon] !== newType) {
                      setWeapon('');
                    }
                  }}
                  className="filter-select"
                >
                  <option value="">All types</option>
                  {WEAPON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-group">
                <span>Weapon</span>
                <select
                  value={weapon}
                  onChange={(e) => setWeapon(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All weapons</option>
                  {WEAPONS.filter((w) => !type || (WEAPON_TYPE_MAP[w] || '') === type).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-group">
                <span>Bonus</span>
                <select
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All bonuses</option>
                  {WEAPON_BONUSES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-group">
                <span>Seller</span>
                <input
                  type="text"
                  placeholder="Torn username"
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  className="filter-input"
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button onClick={loadItems} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {initialLoad && (
            <div className="loading-container">
              <div className="spinner" />
              <p>Loading items...</p>
            </div>
          )}

          {!initialLoad && !error && (
            <>
              {items.length === 0 ? (
                (() => {
                  const hasActiveFilters =
                    weapon ||
                    type ||
                    bonus ||
                    seller ||
                    minPrice !== '' ||
                    maxPrice !== '' ||
                    minQuality !== '' ||
                    minDamage !== '' ||
                    minAccuracy !== '';
                  return hasActiveFilters ? (
                    <div className="empty-state">
                      <p>No items match your filters. Try different filters.</p>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No items listed yet. List your items to get started.</p>
                      <Link to="/list" className="seller-link">
                        List your items
                      </Link>
                    </div>
                  );
                })()
              ) : (
                <>
                  <div className="items-header">
                    <h2>Items ({items.length})</h2>
                  </div>
                  {loading && (
                    <div className="loading-inline">
                      <div className="spinner small" />
                      <span>Updating...</span>
                    </div>
                  )}
                  <div className="items-grid">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onReactionUpdate={handleReactionUpdate}
                      />
                    ))}
                  </div>
                  {hasMore && items.length > 0 && (
                    <div className="load-more-container">
                      <button
                        type="button"
                        className="retry-button load-more-button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default PublicPage;
