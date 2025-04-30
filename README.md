# metalens

> Extract, view, and analyze website metadata from the command line

## Features

- Extract Open Graph, Twitter card, and standard meta tags
- View metadata in a formatted terminal output
- Save metadata as JSON for further analysis
- Preview metadata in a local web interface

![preview](./.github/assets/preview.png)

## Installation

```bash
npm install -g metalens

npx metalens
```

## Usage

```bash
# Provide URL directly
metalens example.com

# Interactive mode
metalens
```

After fetching metadata, choose to:

- View data in the terminal
- Save as JSON file
- Launch local preview in browser

## On the web

The entire metalens service is available online at [metalens.rdsx.dev](https://metalens.rdsx.dev) powered by Cloudflare Workers.

## Development

```bash
git clone https://github.com/rudrodip/metalens.git
cd metalens
bun install
bun run dev
```

## License

MIT
