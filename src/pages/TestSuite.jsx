import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import SimulationPanel from '@/components/game/SimulationPanel';
import { isAdminUser } from '@/lib/admin';
import { useAuth } from '@/lib/AuthContext';

export default function TestSuite() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Regression Test Panel yetkisi kontrol ediliyor"
      >
        <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
      </div>
    );
  }


  if (!isAdminUser(user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm rounded-3xl border border-primary/20 bg-secondary/20 p-6 text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="font-cinzel text-xl font-bold tracking-widest text-primary">ERİŞİM KORUMALI</h1>
          <p className="mt-3 font-inter text-sm text-muted-foreground">
            Regression Test Panel yalnızca admin kullanıcılar için kullanılabilir.
          </p>
          <div className="mt-5 flex gap-2">
            {!user && (
              <Button className="flex-1" onClick={() => base44.auth.redirectToLogin('/test-suite')}>
                Giriş Yap
              </Button>
            )}
            <Button className="flex-1" variant="outline" onClick={() => navigate('/admin')}>
              Admin Ekranı
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at top, #12063a 0%, #0a0e2e 50%, #050716 100%)',
      }}
    >
      <SimulationPanel onClose={() => navigate('/admin')} />
    </div>
  );
}
