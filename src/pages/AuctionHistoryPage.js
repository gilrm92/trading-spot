import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { WEAPONS } from '../data/weapons';
import { WEAPON_BONUSES } from '../data/weaponBonuses';
import './PublicPage.css';
import './AuctionHistoryPage.css';

const PAGE_SIZE = 24;

function formatPrice(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

function formatSoldAt(timestamp) {
  if (timestamp == null) return '—';
  const ms = Number(timestamp) * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? String(timestamp) : d.toLocaleString();
}

function formatPercent(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Number(n).toFixed(1)}%`;
}

function formatBonusTitleLine(title, value) {
  const pct = formatPercent(value);
  if (!title) return null;
  return pct ? `${title} ${pct}` : title;
}

function buildCardTitle(row) {
  const name = row.catalog?.name || 'Unknown weapon';
  const lines = [];
  const b1 = formatBonusTitleLine(row.bonus1?.title, row.bonus1Value);
  const b2 = formatBonusTitleLine(row.bonus2?.title, row.bonus2Value);
  if (b1) lines.push(b1);
  if (b2) lines.push(b2);
  return { name, bonusLines: lines };
}

function AuctionHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [weapon, setWeapon] = useState('');
  const [bonus, setBonus] = useState('');
  const [minBonusPct, setMinBonusPct] = useState('');
  const [maxBonusPct, setMaxBonusPct] = useState('');
  const [offset, setOffset] = useState(0);
  const sentinelRef = useRef(null);

  const loadRows = useCallback(
    async (append = false, fetchOffset = 0) => {
      const currentOffset = append ? fetchOffset : 0;
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);
        const params = {
          limit: PAGE_SIZE,
          offset: currentOffset,
        };
        if (weapon) params.weapon = weapon;
        if (bonus) {
          params.bonus = bonus;
          if (minBonusPct !== '') params.minBonusValue = minBonusPct;
          if (maxBonusPct !== '') params.maxBonusValue = maxBonusPct;
        }

        const data = await api.getAuctionSold(params);

        if (append) {
          setItems((prev) => [...prev, ...data]);
          setOffset(currentOffset + data.length);
        } else {
          setItems(data);
          setOffset(data.length);
        }
        setHasMore(data.length === PAGE_SIZE);
      } catch (err) {
        setError(err.message || 'Failed to load auction history');
        console.error('Auction history load error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [weapon, bonus, minBonusPct, maxBonusPct]
  );

  useEffect(() => {
    loadRows(false, 0);
  }, [loadRows]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting || loadingMore || loading) return;
        loadRows(true, offset);
      },
      { root: null, rootMargin: '320px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset, loadRows]);

  const initialLoad = loading && items.length === 0;
  const bonusValueDisabled = !bonus;

  return (
    <div className="public-page">
      <header className="page-header">
        <div className="container">
          <div className="header-row">
            <div>
              <h1>Auction house — sold weapons</h1>
              <p className="auction-history-subtitle">
                Historical sales from synced auction data (newest first).
              </p>
            </div>
            <Link to="/" className="seller-link">
              Back to hub
            </Link>
          </div>
        </div>
      </header>

      <main className="page-content">
        <div className="container">
          <div className="search-toolbar">
            <div className="filters-row">
              <label className="filter-group">
                <span>Weapon</span>
                <select
                  value={weapon}
                  onChange={(e) => setWeapon(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All weapons</option>
                  {WEAPONS.map((w) => (
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
                  onChange={(e) => {
                    setBonus(e.target.value);
                    if (!e.target.value) {
                      setMinBonusPct('');
                      setMaxBonusPct('');
                    }
                  }}
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
              <div className="filters-row auction-history-bonus-filters" style={{ flexWrap: 'wrap' }}>
                <label className="filter-group">
                  <span>Min bonus %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Min"
                    value={minBonusPct}
                    onChange={(e) => setMinBonusPct(e.target.value)}
                    className="filter-input"
                    disabled={bonusValueDisabled}
                  />
                </label>
                <label className="filter-group">
                  <span>Max bonus %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Max"
                    value={maxBonusPct}
                    onChange={(e) => setMaxBonusPct(e.target.value)}
                    className="filter-input"
                    disabled={bonusValueDisabled}
                  />
                </label>
                {bonusValueDisabled && (
                  <span className="auction-history-bonus-filters-muted">Pick a bonus to filter by %</span>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button type="button" onClick={() => loadRows(false, 0)} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {initialLoad && (
            <div className="loading-container">
              <div className="spinner" />
              <p>Loading sales...</p>
            </div>
          )}

          {!initialLoad && !error && (
            <>
              {items.length === 0 ? (
                <div className="empty-state">
                  <p>No sold weapon listings match your filters (or sync has not collected any yet).</p>
                </div>
              ) : (
                <>
                  <div className="items-header">
                    <h2>Showing {items.length} sale{items.length !== 1 ? 's' : ''}</h2>
                  </div>
                  {loading && (
                    <div className="loading-inline">
                      <div className="spinner small" />
                      <span>Updating...</span>
                    </div>
                  )}
                  <div className="auction-history-grid-wrap">
                    <ul className="auction-history-grid" aria-label="Sold weapons">
                      {items.map((row) => {
                        const { name, bonusLines } = buildCardTitle(row);
                        return (
                          <li key={row.auctionId} className="auction-history-card">
                            <h3 className="auction-history-card-title">
                              <span className="auction-history-name">{name}</span>
                              {bonusLines.map((line, idx) => (
                                <span key={`${row.auctionId}-b-${idx}`} className="auction-history-bonus-line">
                                  {line}
                                </span>
                              ))}
                            </h3>
                            <div className="auction-history-card-price">${formatPrice(row.price)}</div>
                            <div className="auction-history-card-meta">
                              Sold {formatSoldAt(row.timestamp)}
                            </div>
                            <dl className="auction-history-card-details">
                              <div className="auction-history-detail-pair">
                                <dt>Seller</dt>
                                <dd>{row.sellerName || '—'}</dd>
                              </div>
                              <div className="auction-history-detail-pair">
                                <dt>Buyer</dt>
                                <dd>{row.buyerName || '—'}</dd>
                              </div>
                              <div className="auction-history-detail-pair">
                                <dt>Quality</dt>
                                <dd>
                                  {row.quality != null ? formatPercent(row.quality) || '—' : '—'}
                                </dd>
                              </div>
                              <div className="auction-history-detail-pair">
                                <dt>Damage</dt>
                                <dd>{row.damage != null ? row.damage : '—'}</dd>
                              </div>
                              <div className="auction-history-detail-pair">
                                <dt>Accuracy</dt>
                                <dd>{row.accuracy != null ? row.accuracy : '—'}</dd>
                              </div>
                            </dl>
                          </li>
                        );
                      })}
                    </ul>
                    {hasMore && <div ref={sentinelRef} className="auction-history-sentinel" aria-hidden />}
                  </div>
                  {loadingMore && (
                    <div className="loading-inline" style={{ marginTop: '1rem' }}>
                      <div className="spinner small" />
                      <span>Loading more...</span>
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

export default AuctionHistoryPage;
