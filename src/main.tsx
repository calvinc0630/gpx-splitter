import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { CONFIG, logger } from './config/environment';
import { ErrorBoundary } from './components/ErrorBoundary';

// Log application startup in development
logger.info(`Starting ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} in ${CONFIG.NODE_ENV} mode`);

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Failed to find root element');
}

createRoot(rootElement).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);
