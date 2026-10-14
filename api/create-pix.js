const { createCashIn } = require('./sync-client');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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
        return res.status(400).json({ success: false, message: 'JSON inválido no corpo da requisição.' });
      }
    }

    const { name, email, cpf, phone } = body || {};

    // Validações básicas
    if (!name || name.trim().length < 3) {
      return res.status(422).json({
        success: false,
        message: 'Por favor, informe seu nome completo.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(422).json({
        success: false,
        message: 'Por favor, informe um endereço de e-mail válido.'
      });
    }

    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return res.status(422).json({
        success: false,
        message: 'CPF deve conter exatamente 11 dígitos numéricos.'
      });
    }

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return res.status(422).json({
        success: false,
        message: 'Telefone deve conter DDD + número (10 ou 11 dígitos).'
      });
    }

    // Valor da oferta: R$ 37,90
    const amount = 37.90;
    const description = 'RaizFinder - Método Completo de Pesquisa Genealógica';

    const result = await createCashIn({
      amount,
      description,
      client: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        cpf: cleanCpf,
        phone: cleanPhone
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Cobrança Pix gerada com sucesso!',
      pix_code: result.pix_code,
      identifier: result.identifier,
      amount
    });
  } catch (error) {
    console.error('Erro ao gerar Pix no Vercel:', error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Erro ao processar cobrança via Pix.',
      details: error.details || null
    });
  }
};
