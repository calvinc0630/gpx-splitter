import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    maxSize?: number; // in MB
    className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    onFileSelect,
    accept = '.gpx',
    maxSize = 10,
    className = '',
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFile = useCallback(
        (file: File): string | null => {
            if (!file.name.toLowerCase().endsWith('.gpx')) {
                return 'Please select a GPX file (.gpx extension required)';
            }

            if (file.size > maxSize * 1024 * 1024) {
                return `File size must be less than ${maxSize}MB`;
            }

            return null;
        },
        [maxSize]
    );

    const handleFile = useCallback(
        (file: File) => {
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                return;
            }

            setError(null);
            onFileSelect(file);
        },
        [validateFile, onFileSelect]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                handleFile(files[0]);
            }
        },
        [handleFile]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleFile(files[0]);
            }
        },
        [handleFile]
    );

    return (
        <div className={`relative ${className}`}>
            <label
                className={`
          flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer
          transition-colors duration-200 hover:bg-gray-50
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {error ? (
                        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
                    ) : (
                        <Upload
                            className={`w-12 h-12 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
                        />
                    )}

                    {error ? (
                        <p className="text-sm text-red-600 text-center px-4">{error}</p>
                    ) : (
                        <>
                            <p className="mb-2 text-sm text-gray-500">
                                <span className="font-semibold">Click to upload</span> or drag and
                                drop
                            </p>
                            <p className="text-xs text-gray-500">
                                GPX files only (max {maxSize}MB)
                            </p>
                        </>
                    )}

                    <div className="flex items-center mt-4 text-xs text-gray-400">
                        <FileText className="w-4 h-4 mr-1" />
                        <span>Supported: .gpx</span>
                    </div>
                </div>

                <input type="file" className="hidden" accept={accept} onChange={handleFileInput} />
            </label>
        </div>
    );
};
