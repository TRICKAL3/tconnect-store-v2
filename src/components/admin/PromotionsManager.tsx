import React, { useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../lib/getApiBase';
import type { PromotionType } from '../../lib/promotions';
import { safeParseJson } from '../../lib/api';

const API_BASE = getApiBase();

/** For <input type="datetime-local"> — show local calendar time from a Date */
const toDatetimeLocalInput = (d: Date) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

/** datetime-local yields local wall time (no Z). Sending that bare string makes Vercel/Node interpret it as UTC, so schedules can exclude promos while /all still shows them. Send explicit UTC ISO from the browser. */
const localDatetimeInputToUtcIso = (raw: string | undefined): string | undefined => {
  const v = raw?.trim();
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

type PromotionForm = {
  name: string;
  description: string;
  type: PromotionType;
  active: boolean;
  code: string;
  startsAt: string;
  endsAt: string;
  minOrderUsd: string;
  discountPercent: string;
  discountUsd: string;
  maxDiscountUsd: string;
  appliesToCategory: string;
  appliesToProductId: string;
  appliesToProductType: string;
  buyQuantity: string;
  getQuantity: string;
  stackable: boolean;
  priority: string;
};

type TargetScope = 'order' | 'type' | 'category' | 'product';

const defaultForm: PromotionForm = {
  name: '',
  description: '',
  type: 'order_percent',
  active: true,
  code: '',
  startsAt: '',
  endsAt: '',
  minOrderUsd: '',
  discountPercent: '',
  discountUsd: '',
  maxDiscountUsd: '',
  appliesToCategory: '',
  appliesToProductId: '',
  appliesToProductType: '',
  buyQuantity: '',
  getQuantity: '',
  stackable: false,
  priority: '0',
};

const typeOptions: { value: PromotionType; label: string }[] = [
  { value: 'order_percent', label: 'Order % Discount' },
  { value: 'order_fixed', label: 'Order Fixed Discount' },
  { value: 'category_percent', label: 'Category % Discount' },
  { value: 'category_fixed', label: 'Category Fixed Discount' },
  { value: 'product_percent', label: 'Product % Discount' },
  { value: 'product_fixed', label: 'Product Fixed Discount' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y' },
];

const PromotionsManager: React.FC<{ getAdminHeaders: () => Record<string, string> }> = ({ getAdminHeaders }) => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<PromotionForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoDescription, setAutoDescription] = useState(true);
  const [targetScope, setTargetScope] = useState<TargetScope>('order');
  const [periodPreset, setPeriodPreset] = useState<'none' | 'today' | 'weekend' | '7days' | '30days'>('none');

  const getApiErrorMessage = async (res: Response, fallback: string) => {
    const parsed = await safeParseJson<any>(res);
    if (parsed?.error) return String(parsed.error);
    if (parsed?.message) return String(parsed.message);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return 'Promotions API is not available on this backend yet. Deploy/update backend promotions routes.';
    }
    return `${fallback} (${res.status})`;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/promotions/all`, { headers: getAdminHeaders() as HeadersInit });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Failed to load promotions'));
      const data = await safeParseJson<any[]>(res);
      setPromotions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      alert(e.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) return;
        const data = await safeParseJson<any[]>(res);
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      }
    };
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(new Set(products.map((p: any) => p.category).filter(Boolean)));
    return values.sort((a, b) => String(a).localeCompare(String(b)));
  }, [products]);

  const productTypes = useMemo(() => {
    const values = Array.from(new Set(products.map((p: any) => p.type).filter(Boolean)));
    return values.sort((a, b) => String(a).localeCompare(String(b)));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (targetScope === 'type' && form.appliesToProductType) {
      return products.filter((p: any) => p.type === form.appliesToProductType);
    }
    if (targetScope === 'category' && form.appliesToCategory) {
      return products.filter((p: any) => p.category === form.appliesToCategory);
    }
    return products;
  }, [products, targetScope, form.appliesToProductType, form.appliesToCategory]);

  const productName = useMemo(() => {
    const found = products.find((p: any) => p.id === form.appliesToProductId);
    return found?.name || '';
  }, [products, form.appliesToProductId]);

  const generatedDescription = useMemo(() => {
    const targetName =
      targetScope === 'product' ? (productName || 'selected product') :
      targetScope === 'category' ? (form.appliesToCategory || 'selected category') :
      targetScope === 'type' ? (form.appliesToProductType || 'selected product type') :
      'your order';
    if (form.type === 'buy_x_get_y') {
      const buy = form.buyQuantity || '1';
      const get = form.getQuantity || '1';
      return `Buy ${buy} and get ${get} free on ${targetName}. Limited time offer.`;
    }
    if (form.type.endsWith('_percent')) {
      return `Get ${form.discountPercent || '0'}% off on ${targetName}. Limited time offer.`;
    }
    return `Save $${form.discountUsd || '0'} on ${targetName}. Limited time offer.`;
  }, [targetScope, form.type, form.discountPercent, form.discountUsd, form.buyQuantity, form.getQuantity, form.appliesToCategory, form.appliesToProductType, productName]);

  useEffect(() => {
    if (autoDescription) {
      setForm((prev) => ({ ...prev, description: generatedDescription }));
    }
  }, [autoDescription, generatedDescription]);

  useEffect(() => {
    const now = new Date();
    if (periodPreset === 'none') return;
    if (periodPreset === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      setForm((prev) => ({ ...prev, startsAt: toDatetimeLocalInput(start), endsAt: toDatetimeLocalInput(end) }));
      return;
    }
    if (periodPreset === 'weekend') {
      const day = now.getDay();
      const toSaturday = (6 - day + 7) % 7;
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + toSaturday);
      saturday.setHours(0, 0, 0, 0);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      sunday.setHours(23, 59, 0, 0);
      setForm((prev) => ({ ...prev, startsAt: toDatetimeLocalInput(saturday), endsAt: toDatetimeLocalInput(sunday) }));
      return;
    }
    if (periodPreset === '7days' || periodPreset === '30days') {
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(now.getDate() + (periodPreset === '7days' ? 7 : 30));
      setForm((prev) => ({ ...prev, startsAt: toDatetimeLocalInput(start), endsAt: toDatetimeLocalInput(end) }));
    }
  }, [periodPreset]);

  const toPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    active: form.active,
    code: form.code.trim() || undefined,
    startsAt: localDatetimeInputToUtcIso(form.startsAt),
    endsAt: localDatetimeInputToUtcIso(form.endsAt),
    minOrderUsd: form.minOrderUsd || undefined,
    discountPercent: form.discountPercent || undefined,
    discountUsd: form.discountUsd || undefined,
    maxDiscountUsd: form.maxDiscountUsd || undefined,
    appliesToCategory: form.appliesToCategory.trim() || undefined,
    appliesToProductId: form.appliesToProductId.trim() || undefined,
    appliesToProductType: form.appliesToProductType.trim() || undefined,
    buyQuantity: form.buyQuantity || undefined,
    getQuantity: form.getQuantity || undefined,
    stackable: form.stackable,
    priority: form.priority || '0',
  });

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setAutoDescription(true);
    setTargetScope('order');
    setPeriodPreset('none');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('Promotion name is required');
    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(`${API_BASE}/promotions${isEdit ? `/${editingId}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() } as HeadersInit,
        body: JSON.stringify(toPayload()),
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, `Failed to ${isEdit ? 'update' : 'create'} promotion`));
      await load();
      resetForm();
    } catch (e: any) {
      alert(e.message || 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (promotion: any) => {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name || '',
      description: promotion.description || '',
      type: promotion.type || 'order_percent',
      active: promotion.active !== false,
      code: promotion.code || '',
      startsAt: promotion.startsAt ? toDatetimeLocalInput(new Date(promotion.startsAt)) : '',
      endsAt: promotion.endsAt ? toDatetimeLocalInput(new Date(promotion.endsAt)) : '',
      minOrderUsd: promotion.minOrderUsd?.toString() || '',
      discountPercent: promotion.discountPercent?.toString() || '',
      discountUsd: promotion.discountUsd?.toString() || '',
      maxDiscountUsd: promotion.maxDiscountUsd?.toString() || '',
      appliesToCategory: promotion.appliesToCategory || '',
      appliesToProductId: promotion.appliesToProductId || '',
      appliesToProductType: promotion.appliesToProductType || '',
      buyQuantity: promotion.buyQuantity?.toString() || '',
      getQuantity: promotion.getQuantity?.toString() || '',
      stackable: Boolean(promotion.stackable),
      priority: promotion.priority?.toString() || '0',
    });
    setAutoDescription(false);
    if (promotion.appliesToProductId) setTargetScope('product');
    else if (promotion.appliesToCategory) setTargetScope('category');
    else if (promotion.appliesToProductType) setTargetScope('type');
    else setTargetScope('order');
    setPeriodPreset('none');
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this promotion?')) return;
    try {
      const res = await fetch(`${API_BASE}/promotions/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders() as HeadersInit,
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Failed to delete promotion'));
      await load();
      if (editingId === id) resetForm();
    } catch (e: any) {
      alert(e.message || 'Failed to delete promotion');
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-white text-sm';

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className={inputClass} placeholder="Promotion name (e.g. Weekend Steam Deal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select
          className={inputClass}
          value={form.type}
          onChange={(e) => {
            const nextType = e.target.value as PromotionType;
            setForm({
              ...form,
              type: nextType,
              discountUsd: nextType.endsWith('_fixed') ? form.discountUsd : '',
              discountPercent: nextType.endsWith('_percent') ? form.discountPercent : '',
            });
          }}
        >
          {typeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <select
          className={`${inputClass} md:col-span-2`}
          value={targetScope}
          onChange={(e) => {
            const scope = e.target.value as TargetScope;
            setTargetScope(scope);
            setForm((prev) => ({
              ...prev,
              appliesToProductId: scope === 'product' ? prev.appliesToProductId : '',
              appliesToCategory: scope === 'category' ? prev.appliesToCategory : '',
              appliesToProductType: scope === 'type' ? prev.appliesToProductType : '',
            }));
          }}
        >
          <option value="order">Apply to entire order</option>
          <option value="type">Apply to product type (giftcard/wallet/crypto)</option>
          <option value="category">Apply to category</option>
          <option value="product">Apply to one specific product</option>
        </select>

        {targetScope === 'type' && (
          <select
            className={`${inputClass} md:col-span-2`}
            value={form.appliesToProductType}
            onChange={(e) => setForm({ ...form, appliesToProductType: e.target.value, appliesToProductId: '' })}
          >
            <option value="">Select product type</option>
            {productTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {targetScope === 'category' && (
          <select
            className={`${inputClass} md:col-span-2`}
            value={form.appliesToCategory}
            onChange={(e) => setForm({ ...form, appliesToCategory: e.target.value, appliesToProductId: '' })}
          >
            <option value="">Select category</option>
            {categories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        )}

        {(targetScope === 'product' || form.type === 'buy_x_get_y') && (
          <select
            className={`${inputClass} md:col-span-2`}
            value={form.appliesToProductId}
            onChange={(e) => setForm({ ...form, appliesToProductId: e.target.value })}
          >
            <option value="">Select product (scroll and pick)</option>
            {filteredProducts.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} - {p.category} - {p.type}</option>
            ))}
          </select>
        )}

        {form.type.endsWith('_percent') && (
          <input className={inputClass} type="number" step="0.01" placeholder="Discount % (e.g. 10)" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
        )}
        {form.type.endsWith('_fixed') && (
          <input className={inputClass} type="number" step="0.01" placeholder="Discount USD (e.g. 5)" value={form.discountUsd} onChange={(e) => setForm({ ...form, discountUsd: e.target.value })} />
        )}
        {form.type === 'buy_x_get_y' && (
          <>
            <input className={inputClass} type="number" step="1" placeholder="Buy quantity (X)" value={form.buyQuantity} onChange={(e) => setForm({ ...form, buyQuantity: e.target.value })} />
            <input className={inputClass} type="number" step="1" placeholder="Get quantity (Y)" value={form.getQuantity} onChange={(e) => setForm({ ...form, getQuantity: e.target.value })} />
          </>
        )}

        <div className="md:col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-gray-300 text-sm">
            <input type="checkbox" checked={autoDescription} onChange={(e) => setAutoDescription(e.target.checked)} />
            Auto-generate description
          </label>
          {!autoDescription && (
            <button type="button" className="cyber-border px-3 py-1 text-xs" onClick={() => setForm({ ...form, description: generatedDescription })}>
              Regenerate
            </button>
          )}
        </div>
        <input className={`${inputClass} md:col-span-2`} placeholder="Description" value={form.description} onChange={(e) => { setAutoDescription(false); setForm({ ...form, description: e.target.value }); }} />

        <select
          className={inputClass}
          value={periodPreset}
          onChange={(e) => setPeriodPreset(e.target.value as 'none' | 'today' | 'weekend' | '7days' | '30days')}
        >
          <option value="none">Custom period</option>
          <option value="today">Today</option>
          <option value="weekend">This/Next weekend</option>
          <option value="7days">Next 7 days</option>
          <option value="30days">Next 30 days</option>
        </select>
        <div className="text-xs text-gray-400 flex items-center">Use preset or choose custom start/end below</div>
        <input className={inputClass} type="datetime-local" value={form.startsAt} onChange={(e) => { setPeriodPreset('none'); setForm({ ...form, startsAt: e.target.value }); }} />
        <input className={inputClass} type="datetime-local" value={form.endsAt} onChange={(e) => { setPeriodPreset('none'); setForm({ ...form, endsAt: e.target.value }); }} />
        <input className={inputClass} type="number" step="0.01" placeholder="Min order USD (optional)" value={form.minOrderUsd} onChange={(e) => setForm({ ...form, minOrderUsd: e.target.value })} />
        <input className={inputClass} placeholder="Promo code (optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className={inputClass} type="number" step="1" placeholder="Priority (optional)" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
        <input className={inputClass} type="number" step="0.01" placeholder="Max discount USD (optional)" value={form.maxDiscountUsd} onChange={(e) => setForm({ ...form, maxDiscountUsd: e.target.value })} />

        <label className="flex items-center gap-2 text-gray-300 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Active
        </label>
        <label className="flex items-center gap-2 text-gray-300 text-sm">
          <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
          Stackable
        </label>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-cyber px-4 py-2 text-sm">{saving ? 'Saving...' : editingId ? 'Update Promotion' : 'Create Promotion'}</button>
          {editingId && <button type="button" onClick={resetForm} className="cyber-border px-4 py-2 text-sm">Cancel edit</button>}
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-white font-semibold">Existing Promotions</h3>
        {loading ? (
          <p className="text-gray-400">Loading promotions...</p>
        ) : promotions.length === 0 ? (
          <p className="text-gray-400">No promotions yet.</p>
        ) : (
          promotions.map((p) => (
            <div key={p.id} className="border border-dark-border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-white font-medium">{p.name} <span className="text-xs text-gray-400">({p.type})</span></p>
                <p className="text-xs text-gray-400">
                  {p.active ? 'Active' : 'Inactive'} {p.stackable ? '• Stackable' : '• Exclusive'}
                  {p.discountPercent ? ` • ${p.discountPercent}%` : ''}
                  {p.discountUsd ? ` • $${Number(p.discountUsd).toFixed(2)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEdit(p)} className="cyber-border px-3 py-1 text-xs">Edit</button>
                <button onClick={() => onDelete(p.id)} className="px-3 py-1 text-xs border border-red-400/60 text-red-300 rounded">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PromotionsManager;
