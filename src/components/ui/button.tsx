// shadcn/ui Button pattern (Radix Slot + CVA), styled to match the prototype.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
export const buttonVariants = cva('btn', {
  variants: { variant: { default: '', primary: 'p', ghost: 'g', destructive: 'dgr' }, size: { default: '', sm: 'sm', icon: 'ib' } },
  defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
