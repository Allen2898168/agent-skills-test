import crypto from 'node:crypto';

export function encryptFrontendPassword(password) {
  if (!password) {
    throw new Error('Frontend password is required. Configure skills/weex-frontend-ops/.env.local or provide WEEX_FRONTEND_PASSWORD at runtime.');
  }
  return crypto.createHash('md5').update(password).digest('base64');
}
