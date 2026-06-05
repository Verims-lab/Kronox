import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAdminAuthorization } from '../_shared/adminAuth.ts';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user?.email) return json({ ok: false, error: 'Authentication required' }, 401);

    const authorization = await getAdminAuthorization(base44, user);
    return json({
      ok: true,
      isAdmin: authorization.isAdmin,
      role: authorization.role || null,
      status: authorization.status || null,
      source: 'AdminUser',
      statusFunction: 'getAdminStatus',
      debug: authorization.debug,
    });
  } catch (_error) {
    return json({ ok: false, error: 'Authentication required' }, 401);
  }
});
