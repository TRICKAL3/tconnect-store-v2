# PawaPay checkout setup (TConnect)

Mobile money at checkout uses **PawaPay Payment Page** (hosted page — customer picks Airtel/TNM and approves on their phone).

## 1. Environment variables

Add to `backend/.env` (local) and **Vercel → Project → Environment Variables** (production):

| Variable | Example | Notes |
|----------|---------|--------|
| `PAWAPAY_API_TOKEN` | (from dashboard) | **Live** token for your verified account |
| `PAWAPAY_MODE` | `live` | Use `sandbox` only for sandbox token testing |
| `PAWAPAY_CALLBACK_API_BASE` | `https://your-store.vercel.app/api` | Public HTTPS API root (no trailing slash) |
| `FRONTEND_URL` | `https://your-store.vercel.app` | Where customers return after payment |
| `PAWAPAY_COUNTRY` | `MWI` | Malawi (optional, default MWI) |

Restart the API after changing env.

## 2. PawaPay Dashboard

1. **API token** — Dashboard → API tokens → create/copy **production** token into `PAWAPAY_API_TOKEN`.
2. **Callback URLs** (required in dashboard before you can create an API token):

   Replace `YOUR-DOMAIN` with your live site (e.g. `tconnect-store-v2.vercel.app`).

   | Operation | Callback URL |
   |-----------|----------------|
   | **Deposits** | `https://YOUR-DOMAIN/api/payments/pawapay/callback` |
   | **Refunds** | `https://YOUR-DOMAIN/api/payments/pawapay/refund-callback` |

   Must be **HTTPS** and **public** (not `localhost`). Method: `POST`.

   Local dev: run `ngrok http 4001`, then use `https://YOUR-SUBDOMAIN.ngrok-free.app/payments/pawapay/callback` (no `/api` when pointing ngrok at port 4001).
3. Confirm **Malawi** and **MWK** are enabled on your account (Active configuration in dashboard).

## 3. Test flow

1. Deploy with env vars set (callbacks need HTTPS — use Vercel, not localhost-only).
2. Add items to cart → Checkout → **Mobile money**.
3. Sign in → **Pay MWK …** → PawaPay page → complete on phone.
4. You should return to checkout with order confirmation.

Health check: `GET /api/payments/pawapay/status` → `{ "enabled": true, "mode": "live", "country": "MWI", "tokenAccepted": true }`.

If `enabled` is true but `tokenAccepted` is false, the token and `PAWAPAY_MODE` do not match (common: sandbox token with `live` mode).

### Wallet top-up (extra env)

| Variable | Example |
|----------|---------|
| `PAWAPAY_WALLET_RETURN_URL` | `https://www.tconnect.store/wallet` |

## 4. Local development

PawaPay cannot POST callbacks to `localhost`. Options:

- Deploy to Vercel and test there, or
- Run `ngrok http 4001` and set `PAWAPAY_CALLBACK_API_BASE=https://xxxx.ngrok-free.app` (and use the same base in dashboard callback URL).

## 5. Troubleshooting

| Issue | What to check |
|-------|----------------|
| No “Mobile money” button | `PAWAPAY_API_TOKEN` missing on API; hit `/api/payments/pawapay/status` |
| Initiate fails / token rejected | `tokenAccepted: false` on `/api/payments/pawapay/status`; match live token + `PAWAPAY_MODE=live` (or sandbox + `sandbox`); no quotes in Vercel; redeploy |
| Initiate fails / REJECTED | MWK limits, country `MWI`, account not verified for live |
| Paid but order not confirmed | Callback URL in dashboard; Vercel function logs for `[pawapay]` |
| Amount mismatch | Order total MWK vs amount paid on phone |

Orders paid via PawaPay appear in admin with payment method **pawapay** (same pending → approve flow as bank).
