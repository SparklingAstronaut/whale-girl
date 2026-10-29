export function normalize(input = {}) {
  return {visible: typeof input.visible === 'boolean' ? input.visible : true,
    size: Number.isFinite(input.size) ? Math.max(80, Math.min(220, Math.round(input.size))) : 140,
    resetAt: Number.isFinite(input.resetAt) ? input.resetAt : 0};
}
// 只允许本机访问；DSH 桌面端的页面来源只认 dsh-app:// 协议（不写死具体主机名，DSH 改名也不受影响），
// 或者与本机服务同源的 http 页面。
export const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/;
const DSH_ORIGIN = /^dsh-app:\/\/[^/\s]*$/;
export function allowed(req) {
  const host = req.headers.host;
  if (!LOCAL_HOST.test(host || '')) return false;
  const origin = req.headers.origin;
  const fromDsh = !!origin && DSH_ORIGIN.test(origin);
  if (origin && !fromDsh && origin !== `http://${host}`) return false;
  return req.headers['sec-fetch-site'] !== 'cross-site' || fromDsh;
}