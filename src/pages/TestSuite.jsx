import React from 'react';
import { useNavigate } from 'react-router-dom';
import SimulationPanel from '@/components/game/SimulationPanel';

export default function TestSuite() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at top, #12063a 0%, #0a0e2e 50%, #050716 100%)',
      }}
    >
      <SimulationPanel onClose={() => navigate('/settings')} />
    </div>
  );
}
