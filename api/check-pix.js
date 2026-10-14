const { getTransaction } = require('./sync-client');
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

  try {
    const identifier = req.query?.identifier || req.body?.identifier;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro identifier é obrigatório.'
      });
    }

    const result = await getTransaction(identifier);
    const txData = result.data || result;
    const status = txData?.status;

    // Se a transação foi confirmada como paga, dispara evento Purchase no Meta Conversions API
    if (status === 'completed' || status === 'paid') {
      const client = txData?.client || {};
      const amount = txData?.amount || 37.90;
      sendMetaPurchaseEvent({
        eventId: identifier,
        value: amount,
        currency: 'BRL',
        user: client,
        req,
        customData: {
          verified_via_status_polling: true
        }
      }).catch(err => {
        console.error('[CHECK-PIX META CAPI TRIGGER ERROR]:', err);
      });
    }

    return res.status(200).json({
      success: true,
      data: txData
    });
  } catch (error) {
    console.error('Erro ao verificar status do Pix:', error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Erro ao consultar status da transação.',
      details: error.details || null
    });
  }
};
