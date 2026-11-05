import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  const opener=useRef<HTMLElement|null>(null);
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay" /><DialogPrimitive.Content className={cn('dialog-content', className)} {...props} onOpenAutoFocus={event=>{
    opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    onOpenAutoFocus?.(event);
  }} onCloseAutoFocus={event=>{
    onCloseAutoFocus?.(event);
    // Controlled dialogs often open without a Radix Trigger. Preserve keyboard position on close.
    if(!event.defaultPrevented&&opener.current?.isConnected){event.preventDefault();opener.current.focus();}
  }}>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>;
}
