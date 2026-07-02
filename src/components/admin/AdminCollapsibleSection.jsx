import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ADMIN_TOOL_CARD_CLASS,
  ADMIN_TOOL_CHEVRON_CLASS,
  ADMIN_TOOL_DESCRIPTION_CLASS,
  ADMIN_TOOL_HEADER_BUTTON_CLASS,
  ADMIN_TOOL_ICON_CLASS,
  ADMIN_TOOL_SUMMARY_CLASS,
  ADMIN_TOOL_TITLE_CLASS,
} from '@/components/admin/adminVisualStyles';

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
  const visualTone = tone;

  const toggleOpen = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <section
      {...sectionProps}
      className={cn(
        ADMIN_TOOL_CARD_CLASS,
        className,
      )}
      data-admin-collapsible-section
      data-admin-standard-card
      data-admin-section-title={title}
      data-admin-tone={visualTone}
      data-default-open={defaultOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className={ADMIN_TOOL_HEADER_BUTTON_CLASS}
      >
        <div className={ADMIN_TOOL_ICON_CLASS}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={ADMIN_TOOL_TITLE_CLASS}>{title}</p>
          {description && (
            <p className={ADMIN_TOOL_DESCRIPTION_CLASS}>{description}</p>
          )}
        </div>
        {summary && (
          <span className={ADMIN_TOOL_SUMMARY_CLASS}>
            {summary}
          </span>
        )}
        <ChevronDown
          className={cn(ADMIN_TOOL_CHEVRON_CLASS, 'transition-transform', open && 'rotate-180')}
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
