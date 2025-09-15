import type { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
}

export function Card({ children, className = '' }: CardProps) {
    return <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>{children}</div>;
}

interface InfoCardProps {
    label: string;
    value: string | number;
    className?: string;
}

export function InfoCard({ label, value, className = '' }: InfoCardProps) {
    return (
        <div className={`bg-gray-50 p-3 rounded ${className}`}>
            <div className="text-gray-500 text-sm">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    );
}

interface AlertProps {
    type: 'error' | 'success' | 'info' | 'warning';
    children: ReactNode;
    className?: string;
}

const alertStyles = {
    error: 'bg-red-50 border border-red-200 text-red-700',
    success: 'bg-green-50 border border-green-200 text-green-800',
    info: 'bg-blue-50 border border-blue-200 text-blue-700',
    warning: 'bg-yellow-50 border border-yellow-200 text-yellow-700',
};

export function Alert({ type, children, className = '' }: AlertProps) {
    return <div className={`rounded-lg p-4 ${alertStyles[type]} ${className}`}>{children}</div>;
}
