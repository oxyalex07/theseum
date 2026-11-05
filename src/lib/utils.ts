import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const brandAsset = (file: string) => `${import.meta.env.BASE_URL}assets/brand/${file}`;
