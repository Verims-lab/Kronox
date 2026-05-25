import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const displayName = (value: unknown, fallback: string) => String(value || '').trim() || fallback;

async function findFriendship(base44: any, userEmail: string, friendEmail: string) {
  const rows = await base44.asServiceRole.entities.Friendship.filter({
    user_email: userEmail,
    friend_email: friendEmail,
  });
  return rows || [];
}

async function createFriendship(base44: any, owner: { email: string }, friend: { email: string; name: string }) {
  return base44.asServiceRole.entities.Friendship.create({
    user_email: owner.email,
    friend_email: friend.email,
    friend_name: friend.name,
  });
}

async function deleteCreatedRows(base44: any, rows: any[]) {
  for (const row of rows) {
    if (row?.id) {
      await base44.asServiceRole.entities.Friendship.delete(row.id);
    }
  }
}

async function ensureFriendshipPair(
  base44: any,
  receiver: { email: string; name: string },
  sender: { email: string; name: string },
) {
  const receiverRows = await findFriendship(base44, receiver.email, sender.email);
  const senderRows = await findFriendship(base44, sender.email, receiver.email);
  const createdRows: any[] = [];
  let receiverCreated = false;
  let senderCreated = false;

  try {
    if (!receiverRows.length) {
      createdRows.push(await createFriendship(base44, receiver, sender));
      receiverCreated = true;
    }
    if (!senderRows.length) {
      createdRows.push(await createFriendship(base44, sender, receiver));
      senderCreated = true;
    }
  } catch (error) {
    await deleteCreatedRows(base44, createdRows);
    throw error;
  }

  const receiverVisibleRows = receiverRows.length || receiverCreated;
  const senderVisibleRows = senderRows.length || senderCreated;

  return {
    alreadyFriends: Boolean(receiverRows.length && senderRows.length),
    relationshipEnsured: Boolean(receiverVisibleRows && senderVisibleRows),
    friendshipCreated: createdRows.length > 0,
    mirroredRowsCreated: createdRows.length,
  };
}

function json(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, { status });
}

// Receiver-only accept. Ensures the mirrored Friendship rows that the client
// loader expects: one owner row for the receiver, one owner row for the sender.
// RLS forbids a normal client from creating the sender-owned mirror row, so the
// service-role writes are authorized only after the recipient check passes.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || '').trim();
    if (!requestId) {
      return json({ ok: false, error: 'requestId is required' }, 400);
    }

    const fr = await base44.asServiceRole.entities.FriendRequest.get(requestId);
    if (!fr) {
      return json({ ok: false, error: 'Friend request not found' }, 404);
    }

    const myEmail = normalizeEmail(user.email);
    const toEmail = normalizeEmail(fr.to_email);
    const fromEmail = normalizeEmail(fr.from_email);

    if (toEmail !== myEmail) {
      return json({ ok: false, error: 'Only the receiver can accept this request' }, 403);
    }
    if (fr.status !== 'pending' && fr.status !== 'accepted') {
      return json({ ok: false, error: `Request is already ${fr.status}` }, 409);
    }
    if (!fromEmail || fromEmail === toEmail) {
      return json({ ok: false, error: 'Invalid friend request' }, 400);
    }

    const receiver = {
      email: toEmail,
      name: displayName(user.full_name, myEmail),
    };
    const sender = {
      email: fromEmail,
      name: displayName(fr.from_name, fromEmail),
    };

    const relationship = await ensureFriendshipPair(base44, receiver, sender);
    if (!relationship.relationshipEnsured) {
      return json({
        ok: false,
        error: 'Friendship visibility could not be ensured',
        requestStatus: fr.status,
        ...relationship,
      }, 500);
    }

    if (fr.status === 'pending') {
      await base44.asServiceRole.entities.FriendRequest.update(requestId, { status: 'accepted' });
    }

    return json({
      ok: true,
      success: true,
      requestStatus: 'accepted',
      ...relationship,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown acceptFriendRequest error';
    return json({ ok: false, error: message }, 500);
  }
});
