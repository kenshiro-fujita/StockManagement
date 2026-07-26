/**
 * 複数行入力に共通の外観と検証状態を適用します。
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm outline-none transition-[color,box-shadow] [field-sizing:content] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
