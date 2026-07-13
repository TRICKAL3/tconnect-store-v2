import React, { useEffect, useState } from 'react';
import { getApiBase } from '../../lib/getApiBase';

type Row = {
  snapshotId: string;
  userId: string;
  email: string;
  name: string;
  updatedAt: string;
  lineCount: number;
  totalUnits: number;
  items: unknown[];
};

const AbandonedCartsManager: React.FC<{ getAdminHeaders: () => Record<string, string> }> = ({
  getAdminHeaders,
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${getApiBase()}/cart/admin/overview`, {
        headers: { ...getAdminHeaders() },
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = `${res.status}`;
        try {
          const j = JSON.parse(text);
          if (j?.error) msg = String(j.error);
        } catch {
          if (text?.slice(0, 200)) msg = text.slice(0, 200);
        }
        setLoadError(msg);
        setRows([]);
        return;
      }
      try {
        const data = JSON.parse(text);
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setLoadError('Invalid JSON from server');
        setRows([]);
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Request failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearSnapshot = async (userId: string) => {
    if (!window.confirm('Remove this saved cart from the database? The customer can add items again anytime.')) {
      return;
    }
    setClearingId(userId);
    try {
      const res = await fetch(`${getApiBase()}/cart/admin/snapshot/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { ...getAdminHeaders() },
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text.slice(0, 200) || res.statusText;
        try {
          const j = JSON.parse(text);
          if (j?.error) msg = String(j.error);
        } catch {
          /* use msg */
        }
        alert(msg);
        return;
      }
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setClearingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-neon-blue text-white font-medium text-sm disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <p className="text-sm text-gray-400">
          Saved carts clear automatically when an order is created for that account. Use “Clear DB cart” to remove
          stuck rows (e.g. old test data).
        </p>
      </div>

      {loadError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <strong>Could not load carts.</strong> Typical causes: API not deployed with /cart routes, or database table
          missing (run <code className="bg-dark-surface px-1 rounded">npx prisma db push</code> in backend). Server
          said: {loadError}
        </div>
      )}

      {!loadError && !loading && rows.length === 0 && (
        <p className="text-gray-400 text-sm">
          No saved carts yet — customers must be signed in so the app can sync carts to the database.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.snapshotId}
            className="border border-dark-border rounded-xl p-4 bg-dark-surface/80"
          >
            <div className="flex flex-wrap justify-between gap-2 mb-2">
              <div>
                <div className="text-white font-semibold">{r.name || 'User'}</div>
                <div className="text-sm text-neon-blue">
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <a
                  href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent('Your TConnect cart')}&body=${encodeURIComponent('Hello, we noticed you left items in your cart. Can we help you complete your order?')}`}
                  className="text-xs px-3 py-1 rounded-lg bg-neon-blue/15 border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/25"
                >
                  Contact customer
                </a>
                <button
                  type="button"
                  disabled={clearingId === r.userId}
                  onClick={() => clearSnapshot(r.userId)}
                  className="text-xs px-3 py-1 rounded-lg bg-red-500/15 border border-red-400/40 text-red-200 hover:bg-red-500/25 disabled:opacity-40"
                >
                  {clearingId === r.userId ? 'Clearing…' : 'Clear DB cart'}
                </button>
              <div className="text-xs text-gray-400 text-right">
                Updated {new Date(r.updatedAt).toLocaleString()}
                <div>
                  {r.lineCount} line{r.lineCount === 1 ? '' : 's'} · {r.totalUnits} unit
                  {r.totalUnits === 1 ? '' : 's'}
                </div>
              </div>
              </div>
            </div>
            <ul className="text-xs text-gray-300 space-y-1 border-t border-dark-border pt-2 mt-2">
              {Array.isArray(r.items) &&
                r.items.map((it: any, idx: number) => (
                  <li key={idx} className="flex flex-wrap gap-2 justify-between">
                    <span>{it?.name ?? 'Item'}</span>
                    <span className="text-gray-400">
                      {it?.type} · qty {it?.quantity} · ${typeof it?.price === 'number' ? it.price.toFixed(2) : '?'} each
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AbandonedCartsManager;
