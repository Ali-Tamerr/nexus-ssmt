'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Search } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, icon, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-lg bg-zinc-800 text-sm text-white placeholder-zinc-500
              outline-none ring-1 ring-zinc-700 transition-all focus:ring-violet-500
              ${icon ? 'pl-10 pr-4' : 'px-4'} py-2.5
              ${error ? 'ring-red-500' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full rounded-lg bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500
            outline-none ring-1 ring-zinc-700 transition-all focus:ring-violet-500 resize-none
            ${error ? 'ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

interface SearchInputProps extends Omit<InputProps, 'icon'> {
  onSearch?: (value: string) => void;
}

export function SearchInput({ onSearch, onChange, ...props }: SearchInputProps) {
  return (
    <Input
      icon={<Search className="h-4 w-4" />}
      onChange={(e) => {
        onChange?.(e);
        onSearch?.(e.target.value);
      }}
      {...props}
    />
  );
}
