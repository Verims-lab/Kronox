import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  { value: 'tarih', label: 'Tarih' },
  { value: 'bilim', label: 'Bilim' },
  { value: 'spor', label: 'Spor' },
  { value: 'sanat', label: 'Sanat' },
  { value: 'muzik', label: 'Müzik' },
  { value: 'teknoloji', label: 'Teknoloji' },
  { value: 'genel', label: 'Genel' },
];

const TYPES = [
  { value: 'metin', label: 'Text' },
  { value: 'gorsel', label: 'Görsel' },
  { value: 'isitsel', label: 'İşitsel' },
];

const DIFFICULTIES = [
  { value: 1, label: '1 (Kolay)' },
  { value: 2, label: '2 (Orta)' },
  { value: 3, label: '3 (Zor)' },
];


export default function QuestionManagement() {
  const [form, setForm] = useState({
    question: '',
    year: '',
    category: 'genel',
    type: 'metin',
    difficulty: 1,
    media_url: '',
    icon_url: '',
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    // Validation
    if (!form.question.trim()) {
      setError('Question text is required');
      return;
    }
    if (!form.year || isNaN(parseInt(form.year))) {
      setError('Valid year is required');
      return;
    }
    if (!form.category) {
      setError('Category is required');
      return;
    }
    if (!form.type) {
      setError('Type is required');
      return;
    }

    setIsProcessing(true);
    setError('');
    
    try {
      // Create question with media_url
      await base44.entities.Question.create({
        question: form.question.trim(),
        year: parseInt(form.year),
        category: form.category,
        type: form.type,
        difficulty: form.difficulty,
        media_url: form.media_url || undefined,
        icon_url: form.icon_url || undefined,
      });

      setSuccess(true);
      setForm({
        question: '',
        year: '',
        category: 'genel',
        type: 'metin',
        difficulty: 1,
        media_url: '',
        icon_url: '',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create question');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(form.media_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl border border-border/40 bg-secondary/20 space-y-4"
    >
      {/* Question Text */}
      <div className="space-y-1.5">
        <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
          Question Text *
        </label>
        <textarea
          value={form.question}
          onChange={(e) => setForm(prev => ({ ...prev, question: e.target.value }))}
          placeholder="E.g., 'MSN Messenger ne zaman piyasadan çekildi?'"
          maxLength={200}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 font-inter text-sm focus:outline-none focus:border-primary/50 resize-none h-20"
        />
        <p className="font-inter text-xs text-muted-foreground/50">{form.question.length}/200</p>
      </div>

      {/* Year */}
      <div className="space-y-1.5">
        <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
          Year *
        </label>
        <Input
          type="number"
          value={form.year}
          onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
          placeholder="2010"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {/* Category & Type & Difficulty */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
            Category *
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-inter text-sm focus:outline-none focus:border-primary/50"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
            Type *
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-inter text-sm focus:outline-none focus:border-primary/50"
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
            Difficulty *
          </label>
          <select
            value={form.difficulty}
            onChange={(e) => setForm(prev => ({ ...prev, difficulty: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-inter text-sm focus:outline-none focus:border-primary/50"
          >
            {DIFFICULTIES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Media URL */}
      <div className="space-y-1.5">
        <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
          Media URL (Optional)
        </label>
        <div className="flex items-center gap-2">
          <Input
            value={form.media_url}
            onChange={(e) => setForm(prev => ({ ...prev, media_url: e.target.value }))}
            placeholder="https://..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-xs"
          />
          {form.media_url && (
            <button
              onClick={copyToClipboard}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex-shrink-0"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          )}
        </div>
      </div>

      {/* Icon URL (Optional) */}
      <div className="space-y-1.5">
        <label className="font-inter text-xs font-semibold text-muted-foreground uppercase">
          Icon URL (Optional)
        </label>
        <Input
          value={form.icon_url}
          onChange={(e) => setForm(prev => ({ ...prev, icon_url: e.target.value }))}
          placeholder="https://..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-xs"
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="font-inter text-xs text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
          >
            <p className="font-inter text-xs text-emerald-400">Question created successfully!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Button */}
      <Button
        onClick={handleCreate}
        disabled={isProcessing || (!form.question.trim() || !form.year)}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating...
          </>
        ) : (
          'Create Question'
        )}
      </Button>
    </motion.div>
  );
}