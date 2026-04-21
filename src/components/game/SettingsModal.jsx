import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function SettingsModal({ onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await base44.auth.deleteAccount();
      base44.auth.logout('/');
    } catch (e) {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-md bg-card border border-border rounded-t-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-cinzel text-lg text-foreground font-semibold">Ayarlar</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs text-muted-foreground font-inter uppercase tracking-wider">Hesap</p>

            {!confirmDelete ? (
              <Button
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
                onClick={handleDeleteAccount}
              >
                <Trash2 className="w-4 h-4" />
                Hesabı Sil
              </Button>
            ) : (
              <div className="space-y-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex items-center gap-2 text-destructive text-sm font-inter">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Bu işlem geri alınamaz. Tüm verileriniz silinecek.</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    İptal
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? 'Siliniyor…' : 'Evet, Sil'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}