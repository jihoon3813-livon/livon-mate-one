module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  res.status(200).json({
    status: 'online',
    gateway: 'Livon Fax Serverless Gateway v3.0',
    supportedProviders: ['Aligo', 'Popbill', 'SmartSandbox'],
    defaultSender: process.env.FAX_SENDER_NUMBER || '02-556-9114'
  });
};
