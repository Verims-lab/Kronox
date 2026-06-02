# Kronox Security Deployment Notes

Codex157 removes the unused Spotify music-question integration and removes committed personal admin-email checks from source code.

## Removed Spotify Integration

Kronox does not use Spotify now. The old Spotify question helper functions were removed instead of moving their credentials to environment variables.

Removed code:

- legacy music-question provider search helper
- legacy music-question population helper
- legacy music-question load helper
- legacy music-question seed helper tied to that provider workflow

Any previously exposed Spotify client ID or client secret must be revoked or rotated in the Spotify Developer Dashboard. Removing code from the repo does not invalidate already exposed credentials.

## Web Push Secrets

Game invite push delivery is best-effort. In-app invite persistence does not depend on push being configured.

Configure these server secrets in Base44/production:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

The function also accepts the older `KRONOX_VAPID_PUBLIC_KEY`, `KRONOX_VAPID_PRIVATE_KEY`, and `KRONOX_VAPID_SUBJECT` names for compatibility.

Configure this public client build value for browser subscription:

- `VITE_KRONOX_VAPID_PUBLIC_KEY`

Never commit the VAPID private key. Because VAPID keys were reported exposed, rotate the key pair and deploy the new values through the secret manager.

If VAPID config is missing, `sendGameInvitePush` skips push delivery and returns `missing_vapid_config`; the persisted `GameInvite`, header notification, and Online pending invite flow remain available.

## Admin Authorization

Client-side admin UI gating uses `isAdminUser(user)` and recognizes:

- `role === 'admin'`
- `is_admin === true`
- `permissions` containing `admin`

Backend admin-only functions must still enforce authorization server-side. The current backend guard accepts the same role/permission fields and can also read a deployment-secret allowlist:

- `ADMIN_EMAILS`
- `KRONOX_ADMIN_EMAILS`

Use the allowlist only as a deployment fallback until all admin users have a proper role/permission field. Do not commit personal admin emails to source code.

## Verification

After deployment, rerun the external security scanner and verify:

- no Spotify helper functions are deployed,
- no Spotify credentials are present,
- no VAPID key material is committed,
- no personal admin email is committed,
- unauthenticated admin-only function calls return 401,
- authenticated non-admin admin-only function calls return 403,
- authorized admins can still use intended admin tools.
