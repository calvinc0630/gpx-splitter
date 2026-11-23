# GPX Splitter

Web tool to split GPX tracks into segments with visual map and elevation chart interface.

**[Live Demo](https://gpx-splitter.pages.dev/)**

> **Note**: Hobby project built for personal hiking navigation. Contributions are welcome, but ongoing maintenance is not guaranteed.

## Features

- View GPX tracks on a map
- Combined track chart with elevation, speed, and direction
- Hover-sync: hover the chart to highlight the position on the map
- Click the chart to create split points (A, B, C…) with collision-free map markers
- Supports multi-segment GPX tracks (MultiLineString)
- Download segments

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- [just](https://github.com/casey/just) command runner (optional but recommended)
- Modern web browser with JavaScript enabled

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/calvinc0630/gpx-splitter.git
    cd gpx-splitter
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Start the development server:

    ```bash
    just dev
    ```

4. Open your browser to `http://localhost:5173`

## Usage

1. Upload a GPX file
2. Explore the combined track chart: toggle elevation, speed, and direction curves; hover to preview the location on the map (speed and direction require time/bearing data in the file)
3. Click on the map or chart to add split points
4. Download the segments

## Development

### Available Commands

- `just dev` - Start development server
- `just build` - Build for production
- `just preview` - Preview production build locally
- `just test` - Run test suite
- `just lint` - Check code with ESLint

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Leaflet](https://leafletjs.com/) for map visualization
- [Recharts](https://recharts.org/) for track charts
- [@mapbox/togeojson](https://github.com/mapbox/togeojson) for GPX parsing
- [React](https://reactjs.org/) and [Vite](https://vitejs.dev/) for the development experience
