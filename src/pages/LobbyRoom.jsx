import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Legacy compatibility only. Active Online/Duello navigation owns /online and
// never mounts a waiting-room surface.
export default function LobbyRoom() {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: '/online', search: location.search }}
      state={location.state}
      replace
    />
  );
}
