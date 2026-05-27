import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useLobbyRoomState() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [copied, setCopied] = useState(false);
  const [userChecked, setUserChecked] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) setUser(u);
    }).catch(() => {}).finally(() => setUserChecked(true));
  }, []);

  return {
    user,
    mode,
    setMode,
    playerName,
    setPlayerName,
    joinCode,
    setJoinCode,
    lobby,
    setLobby,
    loading,
    setLoading,
    error,
    setError,
    nameError,
    setNameError,
    copied,
    setCopied,
    userChecked,
  };
}
