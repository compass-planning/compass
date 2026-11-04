/**
 * Panel.tsx
 * Standard surface container. Use instead of ad-hoc border/shadow combos.
 */
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  header?: ReactNode;
}

export function Panel({ children, className = '', padded = true, header }: PanelProps) {
  return (
    <div className={cn(
      'rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.03] overflow-hidden',
      className
    )}>
      {header && (
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>
        {children}
      </div>
    </div>
  );
}

export function PanelSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-b border-slate-100 last:border-0 px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-slate-400 font-medium mb-3">{children}</p>
  );
}
