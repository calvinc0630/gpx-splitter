# GPX Splitter

A modern web application for splitting GPX tracks into multiple segments with an intuitive visual interface.

> **Note**: This is a hobby project built for fun and experimentation. Contributions are welcome, but ongoing maintenance is not guaranteed.

## Features

- 🗺️ **Interactive Map Visualization** - View your GPX tracks on an interactive Leaflet map
- 📊 **Elevation Profile** - See elevation changes along your route
- ✂️ **Visual Splitting** - Click on the map or elevation chart to create split points
- 💾 **Export Options** - Download individual segments or all at once

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Modern web browser with JavaScript enabled

### Installation

1. Clone the repository:

    ```bash
    git clone <repository-url>
    cd gpx-splitter
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Start the development server:

    ```bash
    npm run dev
    ```

4. Open your browser to `http://localhost:5173`

## Usage

1. **Upload a GPX file** - Drag and drop a GPX file or click to browse
2. **View your track** - The track will appear on the map with elevation profile below
3. **Create split points** - Click on the map or elevation chart to add split points
4. **Download segments** - Use the export buttons to download individual segments or all at once

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run test` - Run test suite
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Check code with ESLint
- `npm run lint:fix` - Fix auto-fixable ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Leaflet](https://leafletjs.com/) for map visualization
- [Recharts](https://recharts.org/) for elevation charts
- [@mapbox/togeojson](https://github.com/mapbox/togeojson) for GPX parsing
- [React](https://reactjs.org/) and [Vite](https://vitejs.dev/) for the development experience
