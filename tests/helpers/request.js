import { NextRequest } from 'next/server';

/**
 * בונה NextRequest אמיתי לבדיקות, כדי ש-request.cookies / request.headers
 * יתנהגו בדיוק כמו בפרודקשן.
 *
 * makeRequest('/api/foo', { cookies: { 'auth-token': '...' }, headers: {...} })
 */
export function makeRequest(pathOrUrl = '/api/test', options = {}) {
  const { method = 'GET', cookies = {}, headers = {}, body } = options;
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `http://localhost:3000${pathOrUrl}`;

  const init = { method, headers: { ...headers } };
  if (body instanceof FormData) {
    // fetch קובע בעצמו content-type עם ה-boundary הנכון
    init.body = body;
  } else if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['content-type'] = init.headers['content-type'] || 'application/json';
  }

  const request = new NextRequest(url, init);
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}
