# Platz Admin

Next.js admin dashboard for managing the Platz production company platform.

## Tech Stack

- **Framework**: Next.js 15
- **UI**: React 19 + Tailwind CSS 4
- **Components**: shadcn/ui + Radix UI
- **State**: Zustand + React Query
- **Editor**: Editor.js
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

Open [http://localhost:5050](http://localhost:5050)

### Available Scripts

| Command         | Description                           |
| --------------- | ------------------------------------- |
| `npm run dev`   | Start development server on port 5050 |
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

### Content Management

- **Works**: Video projects with metadata, directors, and starring
- **Directors**: Director profiles and portfolio management
- **Starrings**: Talent/actor profiles
- **Presentations**: Custom shareable links for clients

### Photography

- **Items**: Photo management with multi-image support
- **Categories**: Photo categorization
- **Photographers**: Photographer profiles

### Media Library

- Folder-based organization
- Image/video/document uploads
- S3 + CloudFront integration
- Imgix image optimization

### Content Pages

- About page with rich text editor
- Contact page management
- Homepage carousel configuration

### Users & Settings

- User management
- Role-based access
- Site settings

## Project Structure

```
admin/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── dashboard/       # Dashboard
│   │   ├── works/           # Works, Directors, Starrings, Presentations
│   │   ├── photography/     # Photography items, categories
│   │   ├── media/           # Media library
│   │   ├── homepage/        # Homepage settings
│   │   ├── settings/        # Site settings
│   │   └── users/           # User management
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components
│   │   ├── works/           # Works-specific components
│   │   ├── media/           # Media library components
│   │   └── ...
│   ├── services/            # API service functions
│   ├── stores/              # Zustand stores
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities
│   └── types/               # TypeScript types
└── public/                  # Static assets
```

## UI Components

Built with [shadcn/ui](https://ui.shadcn.com/):

- Button, Input, Textarea
- Dialog, Sheet, Dropdown Menu
- Table, Tabs, Card
- Form with validation
- Toast notifications
- And more...

## Production Deployment

### Build

```bash
npm run build
```

### Run

```bash
npm run start -- -p 3001
```

### With PM2

```bash
pm2 start npm --name "platz-admin" -- start -- -p 3001
```

## Admin Access

Default admin credentials (from seed):

- **Email**: admin@example.com
- **Password**: admin123

⚠️ Change these immediately in production!
