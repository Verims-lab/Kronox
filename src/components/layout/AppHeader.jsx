import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const ADMIN_EMAIL = 'sariverim@gmail.com';
const BACK_ROUTES = ['/lobby', '/game'];
const HOME_ROUTES = ['/', '/settings'];

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setIsAdmin(u?.email === ADMIN_EMAIL || u?.role === 'admin');
    }).catch(() => {});
  }, []);

  const showBack = BACK_ROUTES.includes(location.pathname);
  const showHome = HOME_ROUTES.includes(location.pathname);

  if (showBack) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center px-4 h-14 bg-background/80 backdrop-blur-sm border-b border-border/30"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-cinzel text-lg text-primary tracking-widest ml-2">KRONOS</h1>
      </div>
    );
  }

  if (showHome) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm border-b border-border/30"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <h1 className="font-cinzel text-lg text-primary tracking-widest">KRONOS</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { if (isAdmin) navigate('/settings'); }}
          className={isAdmin ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-default'}
          title={isAdmin ? 'Ayarlar' : ''}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return null;
}