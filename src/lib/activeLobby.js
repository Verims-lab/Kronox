import { findActiveLobby } from '@/lib/dbGateway/lobbyGateway';

export async function loadActiveLobbyForUser() {
  try {
    const response = await findActiveLobby();
    return response?.data?.lobby || null;
  } catch {
    return null;
  }
}
