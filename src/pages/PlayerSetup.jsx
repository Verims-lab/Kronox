import React from 'react';
import { Navigate } from 'react-router-dom';

// Legacy compatibility only. `/setup` is redirected in App.jsx before this
// component is mounted; keep this file free of old local category/player setup
// constants while stale external references are phased out.
export default function PlayerSetup() {
  return <Navigate to="/solo" replace />;
}
