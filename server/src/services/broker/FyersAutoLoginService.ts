import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error(`Invalid base32 char: ${clean[i]}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret: string): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, '0');
}

export interface AutoLoginConfig {
  fyId: string;
  pin: string;
  totpKey: string;
  appId?: string;
  secretKey?: string;
  redirectUri?: string;
}

export class FyersAutoLoginService {
  /**
   * Performs full automated headless login using TOTP and PIN.
   * Returns final API v3 access token.
   */
  public static async executeAutoLogin(config?: Partial<AutoLoginConfig>): Promise<{
    success: boolean;
    accessToken?: string;
    message: string;
  }> {
    const fyId = config?.fyId || process.env.FYERS_USER_ID || 'FAK52898';
    const pin = config?.pin || process.env.FYERS_PIN || '';
    const totpKey = config?.totpKey || process.env.FYERS_TOTP_KEY || '';
    const appId = config?.appId || process.env.FYERS_APP_ID || 'R3ZD795FUR-100';
    const secretKey = config?.secretKey || process.env.FYERS_SECRET_KEY || 'MMOAAII27N';
    const redirectUri =
      config?.redirectUri ||
      process.env.FYERS_REDIRECT_URI ||
      'https://trade.fyers.in/api-login/redirect-uri/index.html';

    if (!pin || !totpKey) {
      return {
        success: false,
        message: 'Missing FYERS PIN or TOTP Secret Key in configuration.'
      };
    }

    try {
      console.log(`[AutoLogin] Initiating headless login for ${fyId}...`);

      // 1. send_login_otp
      const otpRes = await fetch('https://api-t2.fyers.in/vagator/v2/send_login_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fy_id: fyId,
          app_id: '2'
        })
      });
      const otpJson = await otpRes.json();
      if (!otpJson.request_key) {
        return { success: false, message: otpJson.message || 'send_login_otp failed' };
      }
      let requestKey = otpJson.request_key;

      // 2. generate live TOTP
      const totpCode = generateTOTP(totpKey);
      console.log(`[AutoLogin] Generated live TOTP: ${totpCode}`);

      // 3. verify_otp (verify TOTP)
      const verifyTotpRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_key: requestKey,
          otp: totpCode
        })
      });
      const verifyTotpJson = await verifyTotpRes.json();
      if (!verifyTotpJson.request_key) {
        return { success: false, message: verifyTotpJson.message || 'verify_otp failed' };
      }
      requestKey = verifyTotpJson.request_key;

      // 4. verify_pin
      const verifyPinRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_key: requestKey,
          identity_type: 'pin',
          pin: pin
        })
      });
      const verifyPinJson = await verifyPinRes.json();
      if (!verifyPinJson.data || !verifyPinJson.data.access_token) {
        return { success: false, message: verifyPinJson.message || 'verify_pin failed. Check your PIN.' };
      }
      const intermediateToken = verifyPinJson.data.access_token;

      // 5. request auth token (v3/token)
      const clientId = appId.includes('-') ? appId.split('-')[0] : appId;
      const appType = appId.includes('-') ? appId.split('-')[1] : '100';

      const tokenRes = await fetch('https://api.fyers.in/api/v3/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${intermediateToken}`
        },
        body: JSON.stringify({
          fyers_id: clientId,
          app_id: appId,
          redirect_uri: redirectUri,
          appType: appType,
          code_challenge: '',
          state: 'pmvision_auto',
          scope: '',
          nonce: '',
          response_type: 'code',
          create_cookie: true
        })
      });
      const tokenJson = await tokenRes.json();
      const redirectUrl = tokenJson.Url || tokenJson.url;
      if (!redirectUrl) {
        return { success: false, message: tokenJson.message || 'Failed to retrieve auth redirect URL' };
      }

      // Extract auth_code from redirect URL
      const urlObj = new URL(redirectUrl);
      const authCode = urlObj.searchParams.get('auth_code') || urlObj.searchParams.get('code');
      if (!authCode) {
        return { success: false, message: 'Could not parse auth_code from FYERS redirect.' };
      }
      console.log(`[AutoLogin] Auth code retrieved headlessly.`);

      // 6. validate-authcode with appIdHash
      const appIdHash = crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');
      const validateRes = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          appIdHash,
          code: authCode
        })
      });
      const validateJson = await validateRes.json();
      if (validateJson.s !== 'ok' || !validateJson.access_token) {
        return { success: false, message: validateJson.message || 'validate-authcode failed' };
      }

      const finalAccessToken = validateJson.access_token;
      console.log(`[AutoLogin] Headless login SUCCESS! Final Access Token generated.`);

      // Update .env if present
      try {
        const envPath = path.resolve(process.cwd(), 'server/.env');
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, 'utf8');
          if (content.includes('FYERS_ACCESS_TOKEN=')) {
            content = content.replace(/FYERS_ACCESS_TOKEN=.*/, `FYERS_ACCESS_TOKEN=${finalAccessToken}`);
          } else {
            content += `\nFYERS_ACCESS_TOKEN=${finalAccessToken}\n`;
          }
          fs.writeFileSync(envPath, content, 'utf8');
        }
      } catch (e) {
        console.warn('[AutoLogin] Could not write to server/.env:', e);
      }

      process.env.FYERS_ACCESS_TOKEN = finalAccessToken;

      return {
        success: true,
        accessToken: finalAccessToken,
        message: 'Headless login completed successfully.'
      };
    } catch (err: any) {
      console.error('[AutoLogin] Error:', err);
      return { success: false, message: err?.message || 'Headless login exception' };
    }
  }
}
