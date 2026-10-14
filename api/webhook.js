// Webhook Handler for Sync Pay Cash-In Notifications
// Note: Sync Pay requires all webhooks to respond within 5 seconds.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const payload = req.body;
    console.log('[SYNC-PAY WEBHOOK RECEIVED]:', JSON.stringify(payload));

    // Exemplos de eventos:
    // status === 'completed', 'paid'
    // identifier da transação
    
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
