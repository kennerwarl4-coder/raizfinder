// Webhook Handler for Sync Pay Cash-In Notifications
// Note: Sync Pay requires all webhooks to respond within 5 seconds.
const { sendMetaPurchaseEvent } = require('./meta-capi');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    console.log('[SYNC-PAY WEBHOOK RECEIVED]:', JSON.stringify(payload));

    const status = payload?.status || payload?.data?.status;
    const identifier = payload?.identifier || payload?.data?.identifier || payload?.id;
    const client = payload?.client || payload?.data?.client || {};
    const amount = payload?.amount || payload?.data?.amount || 37.90;

    // Se o pagamento foi concluído, envia o evento Purchase para a Meta CAPI com o token
    if (status === 'completed' || status === 'paid') {
      sendMetaPurchaseEvent({
        eventId: identifier,
        value: amount,
        currency: 'BRL',
        user: client,
        req,
        customData: {
          webhook_received: true
        }
      }).catch(err => {
        console.error('[WEBHOOK META CAPI TRIGGER ERROR]:', err);
      });
    }

    // Resposta imediata para respeitar o timeout de 5 segundos
    return res.status(200).json({
      received: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SYNC-PAY WEBHOOK ERROR]:', error);
    return res.status(500).json({ received: false, error: error.message });
  }
};
