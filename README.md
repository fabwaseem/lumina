# Lumina

Lumina is an open source desktop gallery for CivitAI images with ComfyUI integration.

## Screenshot

![Lumina Gallery Screenshot](docs/screenshot.jpg)

## Features

- Browse CivitAI images with fast, responsive views
- Masonry, grid, and list layouts with smooth virtualization
- Filters for search, model types, time periods, and sorting
- Lightbox preview with prompt details
- Send prompts to ComfyUI
- Require user-uploaded API workflows with node mapping
- Workflow JSON preview with collapsible, highlighted nodes
- Auto LoRA validation and downloads
- Built-in download manager
- Theme toggle with modern desktop UI chrome

## Download

Get the latest release: https://github.com/fabwaseem/lumina/releases/latest

## Developer

## License & Credits

Lumina is released under the MIT License. If you use or modify this project, please credit the original author:

> Copyright © 2026 Waseem Anjum
> https://waseemanjum.com

See LICENSE for details.

## Requirements

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/fabwaseem/lumina.git
cd lumina
npm install
```

## Local Development

```bash
npm run start
```

## Build

```bash
npm run package
```

```bash
npm run make
```

## Configuration

Open Settings inside the app to configure:

- ComfyUI server URL and base path
- CivitAI API key
- Download path and concurrency limits

## License

MIT License. See LICENSE.
