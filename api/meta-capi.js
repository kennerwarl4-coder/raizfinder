const crypto = require('crypto');

const META_PIXEL_ID = process.env.META_PIXEL_ID || '4754698191442890';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'EAARa5slDBT0BStZBON9hs102trWOmVtqwOUrGLpmQ5qq5V1OxKLeBJNXZCNjqVToDngTYR3c2XnjSNPzNdz7fqPYzlgODDXmu036rJhM5qwvp2XODOgZCxhUZAZAtG8kF7YpLTZCWLQMFrp8buElOTLskvdlZCdH3g3BZAZCBgidZB5LuZA0WKRmZAFACFAF628UKgZDZD';

// In-memory set to prevent duplicate server-side Purchase transmissions
const sentEventsCache = new Set();

/**
 * Standard SHA-256 hash for Meta Conversions API
 */
function sha256(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Normalize phone for Meta (E.164 without '+' sign, standard 55 for Brazil)
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Parse cookies from request header
 */
function parseCookies(req) {
  const cookieHeader = req?.headers?.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v) cookies[k.trim()] = decodeURIComponent(v.trim());
  });
  return cookies;
}

/**
 * Sends a Purchase event to Meta Conversions API (CAPI)
 * @param {Object} options
 * @param {string} options.eventId - Transaction identifier for deduplication
 * @param {number} [options.value=37.90]
 * @param {string} [options.currency='BRL']
 * @param {Object} options.user - { name, email, phone, cpf }
 * @param {Object} [options.req] - Incoming HTTP request for IP and User-Agent
 * @param {string} [options.eventSourceUrl]
 * @param {Object} [options.customData]
 */
async function sendMetaPurchaseEvent({
  eventId,
  value = 37.90,
  currency = 'BRL',
  user = {},
  req = null,
  eventSourceUrl = null,
  customData = {}
}) {
  const dedupKey = `purchase_${eventId || user.email || Date.now()}`;
  if (sentEventsCache.has(dedupKey)) {
    console.log(`[META CAPI] Evento de compra ${dedupKey} já transmitido previamente. Ignorando duplicata.`);
    return { success: true, deduplicated: true };
  }

  // Extract client IP & User Agent
  let clientIp = null;
  let clientUa = null;
  let fbc = null;
  let fbp = null;

  if (req) {
    const forwarded = req.headers['x-forwarded-for'];
    clientIp = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
    clientUa = req.headers['user-agent'];
    const cookies = parseCookies(req);
    fbc = cookies['_fbc'] || null;
    fbp = cookies['_fbp'] || null;
  }

  // Name splitting
  const rawName = (user.name || '').trim();
  const nameParts = rawName ? rawName.split(' ') : [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const userData = {};

  const hashedEmail = sha256(user.email);
  if (hashedEmail) userData.em = [hashedEmail];

  const normPhone = normalizePhone(user.phone);
  const hashedPhone = sha256(normPhone);
  if (hashedPhone) userData.ph = [hashedPhone];

  const hashedFn = sha256(firstName);
  if (hashedFn) userData.fn = [hashedFn];

  const hashedLn = sha256(lastName);
  if (hashedLn) userData.ln = [hashedLn];

  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUa) userData.client_user_agent = clientUa;
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  const eventPayload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: String(eventId || Date.now()),
        event_source_url: eventSourceUrl || 'https://raizfinder.com/checkout.html',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          value: parseFloat(value),
          currency,
          content_name: 'RaizFinder - Método Completo',
          content_type: 'product',
          order_id: String(eventId || ''),
          ...customData
        }
      }
    ]
  };

  try {
    const url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('[META CAPI ERROR]:', response.status, result);
      return { success: false, status: response.status, error: result };
    }

    sentEventsCache.add(dedupKey);
    console.log(`[META CAPI SUCCESS] Purchase registrado com sucesso para id: ${eventId}. fbtrace_id: ${result?.fbtrace_id}`);
    return { success: true, result };

  } catch (err) {
    console.error('[META CAPI NETWORK ERROR]:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  META_PIXEL_ID,
  sendMetaPurchaseEvent
};
