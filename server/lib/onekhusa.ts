import crypto from 'crypto';

// We rely on the global fetch provided by the Node.js runtime on Vercel.
// Declare it for TypeScript so the server build doesn't fail.
declare const fetch: any;

const ONEKHUSA_BASE_URL =
  process.env.ONEKHUSA_BASE_URL || 'https://api.onekhusa.com/sandbox/v1';

const ONEKHUSA_API_KEY = process.env.ONEKHUSA_API_KEY;
const ONEKHUSA_API_SECRET = process.env.ONEKHUSA_API_SECRET;
const ONEKHUSA_ORG_ID = process.env.ONEKHUSA_ORG_ID;
const ONEKHUSA_MERCHANT_ACCOUNT = process.env.ONEKHUSA_MERCHANT_ACCOUNT
  ? parseInt(process.env.ONEKHUSA_MERCHANT_ACCOUNT, 10)
  : undefined;
const ONEKHUSA_CAPTURED_BY_EMAIL =
  process.env.ONEKHUSA_CAPTURED_BY_EMAIL || 'merchant@app.tconnect.store';

let cachedToken: {
  accessToken: string;
  expiresOn: string;
} | null = null;

function isTokenValid(token: typeof cachedToken): boolean {
  if (!token) return false;
  try {
    const expires = new Date(token.expiresOn).getTime();
    const now = Date.now();
    // Add a small safety margin (30 seconds)
    return expires - now > 30_000;
  } catch {
    return false;
  }
}

export async function getOneKhusaAccessToken(): Promise<string> {
  if (!ONEKHUSA_API_KEY || !ONEKHUSA_API_SECRET || !ONEKHUSA_ORG_ID || !ONEKHUSA_MERCHANT_ACCOUNT) {
    throw new Error(
      'OneKhusa env vars missing. Set ONEKHUSA_API_KEY, ONEKHUSA_API_SECRET, ONEKHUSA_ORG_ID, ONEKHUSA_MERCHANT_ACCOUNT.'
    );
  }

  if (isTokenValid(cachedToken)) {
    return cachedToken!.accessToken;
  }

  const res = await fetch(`${ONEKHUSA_BASE_URL}/account/getAccessToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
    },
    body: JSON.stringify({
      apiKey: ONEKHUSA_API_KEY,
      apiSecret: ONEKHUSA_API_SECRET,
      organisationId: ONEKHUSA_ORG_ID,
      merchantAccountNumber: ONEKHUSA_MERCHANT_ACCOUNT,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ [OneKhusa] getAccessToken failed:', res.status, text);
    throw new Error(`OneKhusa getAccessToken failed: ${res.status}`);
  }

  const data: any = await res.json();
  cachedToken = {
    accessToken: data.accessToken,
    expiresOn: data.expiresOn,
  };

  console.log('✅ [OneKhusa] Access token fetched');
  return data.accessToken;
}

function makeIdempotencyKey(prefix: string = 'tconnect'): string {
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}-${Date.now()}-${random}`;
}

interface RequestToPayParams {
  amount: number; // in local currency units (e.g. MWK)
  description: string;
  referenceNumber: string; // 5-25 chars, unique
}

export async function initiateRequestToPay(params: RequestToPayParams) {
  const token = await getOneKhusaAccessToken();

  const res = await fetch(
    `${ONEKHUSA_BASE_URL}/collections/requestToPay/initiate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en',
        'X-Idempotency-Key': makeIdempotencyKey('rtp'),
      },
      body: JSON.stringify({
        merchantAccountNumber: ONEKHUSA_MERCHANT_ACCOUNT,
        transactionAmount: params.amount,
        transactionDescription: params.description,
        referenceNumber: params.referenceNumber,
        capturedBy: ONEKHUSA_CAPTURED_BY_EMAIL,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ [OneKhusa] RequestToPay failed:', res.status, text);
    throw new Error(`OneKhusa RequestToPay failed: ${res.status}`);
  }

  const data: any = await res.json();
  console.log('✅ [OneKhusa] RequestToPay initiated:', {
    reference: params.referenceNumber,
    tan: data.timedAccountNumber,
  });

  return data as {
    merchantAccountNumber: number;
    timedAccountNumber: string;
    expiryDate: string;
    expiryInMinutes: number;
  };
}

interface SingleDisbursementParams {
  amount: number;
  beneficiaryName: string;
  beneficiaryAccountNumber: string;
  connectorId: number;
  sourceReferenceNumber: string;
  description: string;
}

export async function addSingleDisbursement(params: SingleDisbursementParams) {
  const token = await getOneKhusaAccessToken();

  const res = await fetch(`${ONEKHUSA_BASE_URL}/disbursements/single/add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
      'X-Idempotency-Key': makeIdempotencyKey('disb'),
    },
    body: JSON.stringify({
      merchantAccountNumber: ONEKHUSA_MERCHANT_ACCOUNT,
      sourceReferenceNumber: params.sourceReferenceNumber,
      beneficiaryName: params.beneficiaryName,
      beneficiaryAccountNumber: params.beneficiaryAccountNumber,
      connectorId: params.connectorId,
      transactionAmount: params.amount,
      transactionDescription: params.description,
      capturedBy: ONEKHUSA_CAPTURED_BY_EMAIL,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ [OneKhusa] Single disbursement failed:', res.status, text);
    throw new Error(`OneKhusa single disbursement failed: ${res.status}`);
  }

  const data: any = await res.json();
  console.log('✅ [OneKhusa] Single disbursement created:', {
    txRef: data.transactionReferenceNumber,
    code: data.responseCode,
  });

  return data as {
    merchantAccountNumber: number;
    transactionReferenceNumber: string;
    responseCode: string;
  };
}

export async function verifyWebhookSignature(eventCode: string, webhookSignature: string) {
  if (!ONEKHUSA_MERCHANT_ACCOUNT) {
    throw new Error('ONEKHUSA_MERCHANT_ACCOUNT is not configured');
  }

  const token = await getOneKhusaAccessToken();

  const res = await fetch(`${ONEKHUSA_BASE_URL}/merchants/webhooks/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
    },
    body: JSON.stringify({
      merchantAccountNumber: ONEKHUSA_MERCHANT_ACCOUNT,
      eventCode,
      webhookSignature,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ [OneKhusa] Verify webhook failed:', res.status, text);
    throw new Error(`OneKhusa verify webhook failed: ${res.status}`);
  }

  const data: any = await res.json();
  return !!data.isSignatureValid;
}


