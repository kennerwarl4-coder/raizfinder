// Shared Sync Pay API Client with token caching
const SYNC_BASE_URL = 'https://api.syncpayments.com.br';

const CLIENT_ID = process.env.SYNC_CLIENT_ID || '3da22e3f-1bce-42ab-bd28-bc56bb2b4e0b';
const CLIENT_SECRET = process.env.SYNC_CLIENT_SECRET || '23eb4350-3a54-4058-b617-453049da0bfd';

// In-memory token cache to prevent excessive token generation
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtains a valid Bearer token for Sync Pay API.
 * Uses cached token if still valid (tokens last 1 hour).
 */
async function getAuthToken() {
  const now = Date.now();
  // If token is valid and has at least 3 minutes left, reuse it
  if (cachedToken && tokenExpiresAt > now + 180000) {
    return cachedToken;
  }

  const response = await fetch(`${SYNC_BASE_URL}/api/partner/v1/auth-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    const errorMsg = data?.message || `Falha na autenticação Sync Pay (Status ${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  cachedToken = data.access_token;
  // Token expires_in is usually 3600 seconds
  const ttlMs = (data.expires_in || 3600) * 1000;
  tokenExpiresAt = now + ttlMs;

  return cachedToken;
}

/**
 * Creates a Cash-In Pix transaction.
 * @param {Object} params
 * @param {number} params.amount
 * @param {string} params.description
 * @param {Object} params.client { name, cpf, email, phone }
 * @param {string} [params.webhook_url]
 */
async function createCashIn({ amount, description, client, webhook_url }) {
  const token = await getAuthToken();

  const bodyPayload = {
    amount: Number(amount),
    description: description || 'RaizFinder - Metodo Completo',
    client: {
      name: client.name,
      cpf: String(client.cpf).replace(/\D/g, ''),
      email: client.email.trim().toLowerCase(),
      phone: String(client.phone).replace(/\D/g, '')
    }
  };

  if (webhook_url) {
    bodyPayload.webhook_url = webhook_url;
  }

  const response = await fetch(`${SYNC_BASE_URL}/api/partner/v1/cash-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(bodyPayload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Erro ao gerar Pix no Sync Pay (Status ${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

/**
 * Consults transaction status by identifier.
 * @param {string} identifier
 */
async function getTransaction(identifier) {
  const token = await getAuthToken();

  const response = await fetch(`${SYNC_BASE_URL}/api/partner/v1/transaction/${identifier}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Erro ao consultar transação (Status ${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = {
  getAuthToken,
  createCashIn,
  getTransaction,
  CLIENT_ID,
  CLIENT_SECRET
};
