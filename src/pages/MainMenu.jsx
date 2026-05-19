import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const HOME_SCREEN_ASSET = '/assets/ui/home-screen-final.webp';

function Hotspot({ label, onClick, style }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute z-10 bg-transparent p-0"
      style={{
        ...style,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    />
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

  const handleSolo = () => {
    sounds.tap();
    navigate('/solo');
  };

  const handleOnline = () => {
    sounds.tap();
    if (!user) base44.auth.redirectToLogin('/');
    else navigate('/lobby');
  };

  const handleSettings = () => {
    sounds.tap();
    navigate('/settings');
  };

  return (
    <main
      className="relative w-full overflow-hidden bg-black"
      style={{
        minHeight: '100vh',
        height: '100svh',
        userSelect: 'none',
      }}
    >
      <img
        src={HOME_SCREEN_ASSET}
        alt="Kronox"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: 'center center',
          pointerEvents: 'none',
        }}
      />

      <Hotspot
        label="Rekorlar ve ayarlar"
        onClick={handleSettings}
        style={{ left: '3.5%', top: '3.4%', width: '15%', height: '8.4%' }}
      />
      <Hotspot
        label="Ayarlar"
        onClick={handleSettings}
        style={{ right: '3.5%', top: '3.4%', width: '15%', height: '8.4%' }}
      />
      <Hotspot
        label="Hemen oyna"
        onClick={handleSolo}
        style={{ left: '7.5%', top: '56.9%', width: '85%', height: '10.6%' }}
      />
      <Hotspot
        label="Solo meydan okuma"
        onClick={handleSolo}
        style={{ left: '4.8%', top: '70.4%', width: '44%', height: '24.2%' }}
      />
      <Hotspot
        label="Online battle"
        onClick={handleOnline}
        style={{ right: '4.8%', top: '70.4%', width: '44%', height: '24.2%' }}
      />
    </main>
  );
}
