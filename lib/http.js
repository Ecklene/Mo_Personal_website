export function json(res, status, data) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json'); res.statusCode = status; res.end(JSON.stringify(data)); }
export function failure(res, error) {
  console.error(error.message);
  const status = error.status || 500;
  json(res, status, { error: error.publicMessage || (status < 500 ? error.message : 'The service could not complete this request. Please try again.') });
}
export async function body(req, maximum = 3_000_000) {
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > maximum) throw Object.assign(new Error('Request too large'), { status: 413 });
    return req.body;
  }
  if (typeof req.body === 'string') {
    if (req.body.length > maximum) throw Object.assign(new Error('Request too large'), { status: 413 });
    try { return JSON.parse(req.body); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
  }
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > maximum) throw Object.assign(new Error('Request too large'), { status: 413 }); }
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
export function method(req, expected) { if (req.method !== expected) throw Object.assign(new Error('Method not allowed'), { status: 405 }); }
export function query(req) { const params = new URL(req.url, 'https://local.invalid').searchParams; for (const [name,value] of Object.entries(req.query || {})) if (!params.has(name) && typeof value === 'string') params.set(name,value); return params; }
