# Justfile for GPX Splitter

# Run development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Preview production build (Vite)
preview: build
    npm run preview

# Preview with Cloudflare Pages dev server
preview-cf: build
    npx wrangler pages dev dist

# Run tests
test:
    npm run test:run

# Run linter
lint:
    npm run lint

# Build and deploy to dev environment
ship-dev: lint test build
    npx wrangler pages deploy dist --branch=dev

# Build and deploy to production
ship: lint test build
    npx wrangler pages deploy dist --branch=main
