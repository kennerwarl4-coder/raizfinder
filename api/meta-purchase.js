const { sendMetaPurchaseEvent } = require('./meta-capi');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido. Utilize POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'JSON inválido' });
      }
    }

    const { identifier, name, email, phone, cpf, value, currency, eventSourceUrl, customData } = body || {};

    const result = await sendMetaPurchaseEvent({
      eventId: identifier,
      value: value || 37.90,
      currency: currency || 'BRL',
      user: { name, email, phone, cpf },
      req,
      eventSourceUrl: eventSourceUrl || req.headers.referer,
      customData: customData || {}
    });

    return res.status(200).json({
      success: true,
      meta_response: result
    });

  } catch (error) {
    console.error('Erro no endpoint /api/meta-purchase:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao registrar evento de compra no Meta.'
    });
  }
};
