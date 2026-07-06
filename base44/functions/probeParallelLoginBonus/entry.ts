// TEMPORARY admin-only probe: fires two simultaneous claimLoginBonuses
// invocations for the calling admin/test user and returns both sanitized
// results. No direct economy writes happen here. Delete after the probe.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const startedAt = new Date().toISOString();
    const settled = await Promise.allSettled([
      base44.functions.invoke('claimLoginBonuses', {}),
      base44.functions.invoke('claimLoginBonuses', {}),
    ]);

    const sanitize = (r) => {
      if (r.status === 'rejected') {
        return { outcome: 'rejected', message: String(r.reason?.message || r.reason || 'error').slice(0, 300) };
      }
      const d = r.value?.data ?? r.value ?? {};
      return {
        outcome: 'fulfilled',
        ok: d?.ok ?? null,
        starter: d?.grants?.starter_bonus?.status ?? d?.starter?.status ?? null,
        daily: d?.grants?.daily_login?.status ?? d?.daily?.status ?? null,
        diamondBalance: typeof d?.diamonds === 'number' ? d.diamonds : (typeof d?.balance === 'number' ? d.balance : null),
        raw: JSON.stringify(d).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<email>').slice(0, 900),
      };
    };

    return Response.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      results: settled.map(sanitize),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});