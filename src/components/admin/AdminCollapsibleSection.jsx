import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  default: {
    shell: 'border-border/40 bg-secondary/20 hover:border-border/70',
    icon: 'border-primary/20 bg-primary/10 text-primary',
    title: 'text-foreground',
    desc: 'text-muted-foreground',
    summary: 'border-primary/20 bg-primary/10 text-primary',
  },
  danger: {
    shell: 'border-red-300/25 bg-red-300/5 hover:border-red-300/45',
    icon: 'border-red-300/30 bg-red-300/10 text-red-100',
    title: 'text-red-50',
    desc: 'text-blue-100/65',
    summary: 'border-red-300/30 bg-red-500/10 text-red-100',
  },
  warning: {
    shell: 'border-amber-300/25 bg-amber-300/5 hover:border-amber-300/45',
    icon: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
    title: 'text-amber-100',
    desc: 'text-blue-100/65',
    summary: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  },
  info: {
    shell: 'border-cyan-300/25 bg-cyan-300/5 hover:border-cyan-300/45',
    icon: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    title: 'text-cyan-50',
    desc: 'text-blue-100/65',
    summary: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-50',
  },
};

export default function AdminCollapsibleSection({
  title,
  description,
  icon,
  summary,
  tone = 'default',
  defaultOpen = false,
  children,
  className = '',
  bodyClassName = '',
  onOpenChange,
  ...sectionProps
}) {
  const [open, setOpen] = useState(defaultOpen);
  const palette = TONE_CLASSES[tone] || TONE_CLASSES.default;

  const toggleOpen = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <section
      {...sectionProps}
      className={cn(
        'overflow-hidden rounded-2xl border transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        palette.shell,
        className,
      )}
      data-admin-collapsible-section
      data-admin-section-title={title}
      data-default-open={defaultOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border [&>svg]:h-4 [&>svg]:w-4', palette.icon)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-cinzel text-sm font-black tracking-wide', palette.title)}>{title}</p>
          {description && (
            <p className={cn('mt-0.5 line-clamp-2 font-inter text-xs leading-relaxed', palette.desc)}>{description}</p>
          )}
        </div>
        {summary && (
          <span className={cn('hidden shrink-0 rounded-full border px-2.5 py-1 font-inter text-[10px] font-black sm:inline-flex', palette.summary)}>
            {summary}
          </span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={cn('border-t border-white/10 px-4 pb-4 pt-3', bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}
