const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_ID = 'R3ZD795FUR-100';
const SECRET_KEY = 'MMOAAII27N';
const REDIRECT_URI = 'https://trade.fyers.in/api-login/redirect-uri/index.html';

async function validateAuthCode(authCode) {
  if (!authCode) {
    console.error('Error: Please provide the auth_code as an argument.');
    process.exit(1);
  }

  // If the user pasted the entire URL, extract auth_code from query params
  if (authCode.includes('auth_code=')) {
    const match = authCode.match(/auth_code=([^&]+)/);
    if (match) {
      authCode = match[1];
    }
  }

  const appIdHash = crypto
    .createHash('sha256')
    .update(`${APP_ID}:${SECRET_KEY}`)
    .digest('hex');

  console.log(`[FYERS] Validating Auth Code with AppIdHash: ${appIdHash.slice(0, 8)}...`);

  const payload = {
    grant_type: 'authorization_code',
    appIdHash,
    code: authCode
  };

  try {
    const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('[FYERS Response]', data);

    if (data.s === 'ok' && data.access_token) {
      console.log('SUCCESS! Access Token obtained.');
      // Update .env file
      const envPath = path.resolve(__dirname, '../../.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (envContent.includes('FYERS_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/FYERS_ACCESS_TOKEN=.*/, `FYERS_ACCESS_TOKEN=${data.access_token}`);
      } else {
        envContent += `\nFYERS_ACCESS_TOKEN=${data.access_token}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      console.log('Updated server/.env with new FYERS_ACCESS_TOKEN');
      return data.access_token;
    } else {
      console.error('FYERS returned error:', data.message || data);
    }
  } catch (err) {
    console.error('Request failed:', err);
  }
}

const inputCode = process.argv[2];
if (inputCode) {
  validateAuthCode(inputCode);
} else {
  console.log('Usage: node fyersToken.cjs <auth_code_or_url>');
}

module.exports = { validateAuthCode };
