import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Routes where we show back button instead of logo
const BACK_ROUTES = ['/lobby', '/game'];

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  const showBack = BACK_ROUTES.includes(location.pathname);

  if (!showBack) {
    // On home/settings the pages handle their own headers (or none needed)
    return null;
  }

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