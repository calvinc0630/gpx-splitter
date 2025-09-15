import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { CONFIG, logger } from './config/environment';
import { ErrorBoundary } from './components/ErrorBoundary';

// Log application startup in development
logger.info(`Starting ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} in ${CONFIG.NODE_ENV} mode`);

// Apply environment-specific configuration
const rootElement = document.getElementById('root');
if (!rootElement) {
    logger.error('Root element not found');
    throw new Error('Failed to find root element');
}

// Use React StrictMode only in development for better performance in production
const AppWrapper = CONFIG.FEATURES.REACT_STRICT_MODE ? (
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
) : (
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);

createRoot(rootElement).render(AppWrapper);
