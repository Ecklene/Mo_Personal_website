import { equal } from '../lib/auth.js';
import { required, configuration } from '../lib/config.js';
import { generate, scheduleSlot } from '../lib/generate.js';
import { failure, json } from '../lib/http.js';
export default async function handler(req, res) {
  try {
    if (!['GET','POST'].includes(req.method)) throw Object.assign(new Error('Method not allowed'), { status: 405 });
    if (!equal(req.headers.authorization, `Bearer ${required('CRON_SECRET')}`)) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    if (process.env.BLOG_AUTOMATION_ENABLED !== 'true') return json(res, 200, { skipped: true, message: 'Automation is disabled until setup and a test email are complete.' });
    const config = configuration();
    if (!config.publishing || !config.generation || !config.email) throw Object.assign(new Error('Complete storage, generation and email setup before activation.'), { status: 503 });
    const slot = scheduleSlot(); if (!slot) return json(res, 200, { skipped: true, message: 'No draft scheduled today.' });
    const result = await generate(slot);
    return json(res, 200, { skipped: result.skipped || false, id: result.post?.id, emailed: result.emailed || false });
  } catch (error) { return failure(res, error); }
}
