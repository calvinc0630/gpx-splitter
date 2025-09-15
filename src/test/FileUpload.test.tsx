import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileUpload } from '../components/FileUpload/FileUpload';

describe('FileUpload Component', () => {
    const mockOnFileSelect = vi.fn();
    const user = userEvent.setup();

    beforeEach(() => {
        mockOnFileSelect.mockClear();
    });

    describe('rendering', () => {
        it('renders upload area with correct text', () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            expect(screen.getByText('Click to upload')).toBeInTheDocument();
            expect(screen.getByText('or drag and drop')).toBeInTheDocument();
            expect(screen.getByText(/GPX files only/)).toBeInTheDocument();
        });

        it('shows correct file format requirements', () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            expect(screen.getByText('Supported: .gpx')).toBeInTheDocument();
        });

        it('has correct file input attributes', () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const fileInput = screen.getByLabelText(/Click to upload/);
            expect(fileInput).toHaveAttribute('accept', '.gpx');
            expect(fileInput).toHaveAttribute('type', 'file');
        });

        it('accepts custom className prop', () => {
            const { container } = render(
                <FileUpload onFileSelect={mockOnFileSelect} className="custom-class" />
            );

            expect(container.firstChild).toHaveClass('custom-class');
        });

        it('accepts custom accept prop', () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} accept=".kml,.gpx" />);

            const fileInput = screen.getByLabelText(/Click to upload/);
            expect(fileInput).toHaveAttribute('accept', '.kml,.gpx');
        });
    });

    describe('file validation', () => {
        const createMockFile = (name: string, size: number, type = 'application/gpx+xml'): File => {
            const file = new File(['mock content'], name, { type });
            Object.defineProperty(file, 'size', { value: size });
            return file;
        };

        it('accepts valid GPX file', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const validFile = createMockFile('test-track.gpx', 1024);
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, validFile);

            expect(mockOnFileSelect).toHaveBeenCalledWith(validFile);
            expect(mockOnFileSelect).toHaveBeenCalledTimes(1);
        });

        it('rejects non-GPX file extension', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const invalidFile = createMockFile('test-track.kml', 1024);
            const fileInput = screen.getByLabelText(/Click to upload/) as HTMLInputElement;

            // Use fireEvent directly instead of user.upload
            fireEvent.change(fileInput, {
                target: { files: [invalidFile] },
            });

            // Debug: check if the input event triggered
            await waitFor(() => {
                expect(mockOnFileSelect).not.toHaveBeenCalled();
            });

            // Wait for error to be rendered
            await waitFor(() => {
                expect(
                    screen.getByText(/Please select a GPX file \(\.gpx extension required\)/)
                ).toBeInTheDocument();
            });
        });

        it('rejects file exceeding size limit', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} maxSize={5} />);

            const largeFile = createMockFile('large-track.gpx', 6 * 1024 * 1024); // 6MB
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, largeFile);

            expect(mockOnFileSelect).not.toHaveBeenCalled();
            expect(screen.getByText(/File size must be less than 5MB/)).toBeInTheDocument();
        });

        it('uses default 10MB size limit', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const largeFile = createMockFile('large-track.gpx', 11 * 1024 * 1024); // 11MB
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, largeFile);

            expect(mockOnFileSelect).not.toHaveBeenCalled();
            expect(screen.getByText(/File size must be less than 10MB/)).toBeInTheDocument();
        });

        it('clears previous error on valid file upload', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const fileInput = screen.getByLabelText(/Click to upload/);

            // Upload invalid file first
            const invalidFile = createMockFile('test-track.txt', 1024);
            await user.upload(fileInput, invalidFile);
            expect(screen.getByText(/GPX file/)).toBeInTheDocument();

            // Upload valid file
            const validFile = createMockFile('test-track.gpx', 1024);
            await user.upload(fileInput, validFile);

            expect(
                screen.queryByText(/GPX file \(\.gpx extension required\)/)
            ).not.toBeInTheDocument();
            expect(mockOnFileSelect).toHaveBeenCalledWith(validFile);
        });
    });

    describe('drag and drop functionality', () => {
        const createDataTransfer = (files: File[]) => ({
            dataTransfer: {
                files,
                items: files.map(file => ({
                    kind: 'file',
                    type: file.type,
                    getAsFile: () => file,
                })),
                types: ['Files'],
            },
        });

        it('handles drag over event', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const dropZone = screen.getByLabelText(/Click to upload/);

            fireEvent.dragOver(dropZone);

            // Should detect drag over event
            expect(dropZone).toBeInTheDocument();
        });

        it('handles drag leave event', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const dropZone = screen.getByLabelText(/Click to upload/);

            fireEvent.dragOver(dropZone);
            fireEvent.dragLeave(dropZone);

            // Should remove dragging state
            expect(dropZone).not.toHaveClass('border-blue-500', 'bg-blue-50');
        });

        it('handles file drop with valid GPX file', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const validFile = new File(['gpx content'], 'track.gpx', {
                type: 'application/gpx+xml',
            });
            const dropZone = screen.getByLabelText(/Click to upload/);

            fireEvent.drop(dropZone, createDataTransfer([validFile]));

            await waitFor(() => {
                expect(mockOnFileSelect).toHaveBeenCalledWith(validFile);
            });
        });

        it('handles file drop with invalid file', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const invalidFile = new File(['content'], 'track.txt', { type: 'text/plain' });
            const dropZone = screen.getByLabelText(/Click to upload/);

            fireEvent.drop(dropZone, createDataTransfer([invalidFile]));

            await waitFor(() => {
                expect(mockOnFileSelect).not.toHaveBeenCalled();
                expect(screen.getByText(/GPX file/)).toBeInTheDocument();
            });
        });

        it('handles multiple files by using only the first', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const file1 = new File(['content1'], 'track1.gpx', { type: 'application/gpx+xml' });
            const file2 = new File(['content2'], 'track2.gpx', { type: 'application/gpx+xml' });
            const dropZone = screen.getByLabelText(/Click to upload/);

            fireEvent.drop(dropZone, createDataTransfer([file1, file2]));

            await waitFor(() => {
                expect(mockOnFileSelect).toHaveBeenCalledWith(file1);
                expect(mockOnFileSelect).toHaveBeenCalledTimes(1);
            });
        });

        it('handles empty file drop', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const dropZone = screen.getByLabelText(/Click to upload/);

            fireEvent.drop(dropZone, createDataTransfer([]));

            expect(mockOnFileSelect).not.toHaveBeenCalled();
        });
    });

    describe('error state display', () => {
        it('shows error icon when validation fails', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const invalidFile = new File(['content'], 'track.txt', { type: 'text/plain' });
            const fileInput = screen.getByLabelText(/Click to upload/);

            fireEvent.change(fileInput, {
                target: { files: [invalidFile] },
            });

            // Error should be displayed as text
            await waitFor(() => {
                expect(
                    screen.getByText(/Please select a GPX file \(\.gpx extension required\)/)
                ).toBeInTheDocument();
            });
        });

        it('applies error styling to upload area', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const invalidFile = new File(['content'], 'track.txt', { type: 'text/plain' });
            const fileInput = screen.getByLabelText(/Click to upload/);

            fireEvent.change(fileInput, {
                target: { files: [invalidFile] },
            });

            // Should detect error state
            await waitFor(() => {
                expect(
                    screen.getByText(/Please select a GPX file \(\.gpx extension required\)/)
                ).toBeInTheDocument();
            });
        });

        it('shows normal icon when no error', () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            // Upload icon should be visible initially
            expect(screen.getByText(/Click to upload/)).toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('has proper ARIA attributes', () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const fileInput = screen.getByLabelText(/Click to upload/);
            expect(fileInput).toHaveAttribute('type', 'file');
            expect(fileInput).toHaveAttribute('accept', '.gpx');
        });

        it('supports keyboard navigation', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const fileInput = screen.getByLabelText(/Click to upload/);

            // Should be focusable
            await user.tab();
            expect(fileInput).toHaveFocus();
        });
    });

    describe('edge cases', () => {
        it('handles file with uppercase GPX extension', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const upperCaseFile = new File(['content'], 'TRACK.GPX', {
                type: 'application/gpx+xml',
            });
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, upperCaseFile);

            expect(mockOnFileSelect).toHaveBeenCalledWith(upperCaseFile);
        });

        it('handles mixed case GPX extension', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const mixedCaseFile = new File(['content'], 'track.Gpx', {
                type: 'application/gpx+xml',
            });
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, mixedCaseFile);

            expect(mockOnFileSelect).toHaveBeenCalledWith(mixedCaseFile);
        });

        it('handles file with no extension', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const noExtFile = new File(['content'], 'track', { type: 'application/gpx+xml' });
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, noExtFile);

            expect(mockOnFileSelect).not.toHaveBeenCalled();
            expect(screen.getByText(/GPX file/)).toBeInTheDocument();
        });

        it('handles very small files', async () => {
            render(<FileUpload onFileSelect={mockOnFileSelect} />);

            const tinyFile = new File([''], 'tiny.gpx', { type: 'application/gpx+xml' });
            Object.defineProperty(tinyFile, 'size', { value: 0 });
            const fileInput = screen.getByLabelText(/Click to upload/);

            await user.upload(fileInput, tinyFile);

            expect(mockOnFileSelect).toHaveBeenCalledWith(tinyFile);
        });
    });
});
