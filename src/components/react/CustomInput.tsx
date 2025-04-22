import type { ReadonlySignal } from '@preact/signals-react';
import { type ChangeEventHandler, type FocusEventHandler, forwardRef } from 'react';

type TextInputProps = {
    name: string;
    type: 'text' | 'email' | 'tel' | 'password' | 'url' | 'date';
    label?: string;
    placeholder?: string;
    value: ReadonlySignal<string | undefined>;
    error: ReadonlySignal<string>;
    required?: boolean;
    onChange: ChangeEventHandler<HTMLInputElement>;
    onBlur: FocusEventHandler<HTMLInputElement>;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
    ({ label, value, error, ...props }, ref) => {
        const { name, required } = props;
        return (
            <div className="flex w-full flex-1">
                <input
                    className='flex-1 px-3 py-2 rounded-lg bg-background-200 text-text-900 placeholder:text-background-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition'
                    {...props}
                    ref={ref}
                    id={name}
                    placeholder={`${label}${required && "*"}`}
                    value={value.value || ''}
                    aria-invalid={!!error.value}
                    aria-errormessage={`${name}-error`}
                />
                {error.value && <div id={`${name}-error`}>{error}</div>}
            </div>
        );
    }
);
