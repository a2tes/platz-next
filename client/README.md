# Platz Client

Next.js public website for the Platz production company.

## Tech Stack

- **Framework**: Next.js 16
- **UI**: React 19 + Tailwind CSS 3
- **Animation**: GSAP + Framer Motion
- **Icons**: Tabler Icons

## Getting Started

### Prerequisites

- Node.js 20+

### Installation

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

Open [http://localhost:5052](http://localhost:5052)

### Available Scripts

| Command         | Description                           |
| --------------- | ------------------------------------- |
| `npm run dev`   | Start development server on port 5052 |
| `npm run build` | Create production build               |
| `npm run start` | Start production server               |
| `npm run lint`  | Run ESLint                            |

## Environment Variables

```env
# API Connection
NEXT_PUBLIC_PROTOCOL=http
NEXT_PUBLIC_HOSTNAME=localhost
NEXT_PUBLIC_PORT=5051

# Image CDN
NEXT_PUBLIC_IMGIX_URL=your-source.imgix.net
```

## Features

### Pages

- **Home**: Hero video carousel with directors
- **Works**: Video project listings with modal player
- **Directors**: Director portfolios with their works
- **Photography**: Photo galleries with lightbox
- **About**: Company information
- **Contact**: Contact details

### UI/UX

- Responsive design
- Smooth scroll animations
- Video hover previews
- Full-screen video modal
- Mouse trail effect
- Scroll progress indicator

## Project Structure

```
client/
├── app/
│   ├── page.tsx             # Homepage
│   ├── layout.tsx           # Root layout
│   ├── works/               # Works listing & detail
│   ├── directors/           # Directors & their works
│   ├── photography/         # Photo gallery
│   ├── about/               # About page
│   └── contact/             # Contact page
├── components/
│   ├── Navbar.tsx           # Navigation
│   ├── DropdownMenu.tsx     # Mobile menu
│   ├── ScrollProgress.tsx   # Scroll indicator
│   ├── MouseTrail.tsx       # Cursor effect
│   ├── works/               # Work components
│   ├── photography/         # Photo components
│   └── ui/                  # UI components
├── contexts/
│   └── NavbarContext.tsx    # Navbar data caching
├── lib/
│   └── utils.ts             # Utilities
└── public/                  # Static assets
```

## Key Components

### WorkModal

Full-screen video player with controls:

- Play/Pause
- Progress bar
- Mute toggle
- Fullscreen

### WorkCard

Video thumbnail with hover preview:

- Shows image by default
- Plays muted video on hover
- Click opens WorkModal

### PhotoModal

Lightbox for photography:

- Keyboard navigation
- Swipe gestures
- Zoom support

## Production Deployment

### Build

```bash
npm run build
```

### Run

```bash
npm run start -- -p 3000
```

### With PM2

```bash
pm2 start npm --name "platz-client" -- start -- -p 3000
```

## Performance

- Image optimization via Imgix
- Video streaming via CloudFront
- Lazy loading for media
- Code splitting per route
