// api/carecall/openai-key.js
// OpenAI API Key Resolver for Local & Vercel Environments

const fs = require('fs');
const path = require('path');

const ENC_KEY = 'c2stcHJvai1BLTlaLU9QV3pvRU0zakFJYnU4TndyMkhKNGRDX2ZtdmZVcGszcEJ2VVhhb1FEQjc2MjFaQlctVmRLNEJNQUlSTGUzLTlGMHphYVQzQmxia0ZKYVNYeVk3enljRlM4c0s5TjBKMmQyM0hMdzNWeXlnU2hJaExrSTdKaHU1RDd0R0RXVy1yT0tNYWROcktLUXROZGk3Y0RjZ2FISUE=';

function getOpenAiApiKey() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    return process.env.OPENAI_API_KEY;
  }
  const envCandidates = [
    path.join(__dirname, '../../.env.local'),
    path.join(__dirname, '../.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of envCandidates) {
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf8');
        const m = text.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)$/m);
        if (m && m[1]) {
          const k = m[1].trim().replace(/^["']|["']$/g, '');
          if (k && k.startsWith('sk-')) {
            process.env.OPENAI_API_KEY = k;
            return k;
          }
        }
      } catch (_) {}
    }
  }
  try {
    const decoded = Buffer.from(ENC_KEY, 'base64').toString('utf8');
    process.env.OPENAI_API_KEY = decoded;
    return decoded;
  } catch (_) {
    return null;
  }
}

module.exports = { getOpenAiApiKey };
