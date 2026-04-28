import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    // Service role ile soruları çek — auth gerekmez
    const base44 = createClientFromRequest(req);
    const questions = await base44.asServiceRole.entities.Question.list('-created_date', 500);
    return Response.json({ questions: questions || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});