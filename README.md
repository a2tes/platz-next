# Platz Production Company

A full-stack content management system for a production company, featuring video works management, client presentations, and media library.

## Project Structure

```
platz-next/
├── api/          # Express.js REST API with Prisma ORM
├── admin/        # Next.js admin dashboard
├── client/       # Next.js public website
└── storage/      # Local file uploads (not in git)
```

## Tech Stack

| Service | Framework                        | Port (Dev) |
| ------- | -------------------------------- | ---------- |
| API     | Express.js 5 + Prisma + MySQL    | 5051       |
| Admin   | Next.js 15 + React 19 + Tailwind | 5050       |
| Client  | Next.js 16 + React 19 + Tailwind | 5052       |

## Quick Start

### Prerequisites

- Node.js 20+
- MySQL 8+
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/platz-next.git
cd platz-next

# Install all dependencies (workspaces)
npm install

# Set up environment variables
cp api/.env.example api/.env
cp admin/.env.example admin/.env
cp client/.env.example client/.env
# Edit each .env file with your configuration

# Set up database
cd api
npx prisma migrate deploy
npx prisma db seed
cd ..

# Start all services
npm run dev
```

### Access Points (Development)

- **Client**: http://localhost:5052
- **Admin**: http://localhost:5050
- **API**: http://localhost:5051

## Environment Variables

### API (`api/.env`)

```env
DATABASE_URL="mysql://user:password@localhost:3306/platz_db"
JWT_ACCESS_SECRET="your-secret"
JWT_REFRESH_SECRET="your-secret"
AWS_S3_BUCKET="your-bucket"
AWS_ACCESS_KEY_ID="xxx"
AWS_SECRET_ACCESS_KEY="xxx"
NEXT_PUBLIC_CLOUDFRONT_URL="https://xxx.cloudfront.net"
```

### Admin & Client

```env
NEXT_PUBLIC_PROTOCOL=http
NEXT_PUBLIC_HOSTNAME=localhost
NEXT_PUBLIC_PORT=5051
NEXT_PUBLIC_IMGIX_URL=your-source.imgix.net
```

## Production Deployment

See individual README files in each service directory for deployment instructions.

### Domain Structure

| Subdomain          | Service |
| ------------------ | ------- |
| `domain.com`       | Client  |
| `admin.domain.com` | Admin   |
| `api.domain.com`   | API     |

## Features

- **Works Management**: Video projects
- **Presentations**: Custom shareable links for client pitches
- **Media Library**: S3/CloudFront integrated file management
- **Content Pages**: About, Contact with rich text editor

## License

Private - All rights reserved.
