import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'success' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    icon?: ReactNode;
}

const buttonVariants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary:
        'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-300',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const buttonSizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    icon,
    className = '',
    ...props
}: ButtonProps) {
    const baseClasses =
        'font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variantClasses = buttonVariants[variant];
    const sizeClasses = buttonSizes[size];

    return (
        <button
            className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
            {...props}
        >
            {icon && icon}
            {children}
        </button>
    );
}
