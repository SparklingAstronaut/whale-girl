export function normalize(input = {}) {
  return {visible: typeof input.visible === 'boolean' ? input.visible : true,
    size: Number.isFinite(input.size) ? Math.max(80, Math.min(220, Math.round(input.size))) : 140,
    resetAt: Number.isFinite(input.resetAt) ? input.resetAt : 0};
}
export function allowed(req) {
  const host = req.headers.host;
  if (!/^127\.0\.0\.1:\d+$/.test(host || '')) return false;
  const origin = req.headers.origin;
  if (origin && origin !== 'dsh-app://app' && origin !== `http://${host}`) return false;
  return req.headers['sec-fetch-site'] !== 'cross-site' || origin === 'dsh-app://app';
}
