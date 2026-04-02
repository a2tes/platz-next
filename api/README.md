# Platz API

Express.js REST API with Prisma ORM for the Platz production company platform.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 5
- **ORM**: Prisma 6
- **Database**: MySQL 8
- **Auth**: JWT (access + refresh tokens)
- **Storage**: AWS S3 + CloudFront
- **Image Processing**: Sharp + Imgix

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8+

### Installation

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npx prisma migrate deploy

# Seed the database (optional)
npx prisma db seed

# Start development server
npm run dev
```

### Available Scripts

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start development server with hot reload |
| `npm run build`    | Compile TypeScript to `dist/`            |
| `npm run start`    | Start production server                  |
| `npm run db:seed`  | Seed database with initial data          |
| `npm run db:reset` | Reset database and seed                  |

## Environment Variables

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/platz_db"

# Server
NODE_ENV=development
PORT=5051

# JWT Authentication
JWT_ACCESS_SECRET=your-strong-secret-key
JWT_REFRESH_SECRET=your-strong-secret-key
JWT_ACCESS_EXPIRES_IN=4h
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=eu-central-1
AWS_S3_BUCKET=your-bucket-name

# CDN
NEXT_PUBLIC_CLOUDFRONT_URL=https://xxx.cloudfront.net
NEXT_PUBLIC_IMGIX_URL=your-source.imgix.net
NEXT_PUBLIC_IMGIX_SECURE_URL_TOKEN=xxx

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5050,http://localhost:5052

# Local Storage (alternative to S3)
MEDIA_LIBRARY_LOCAL_PATH=/path/to/storage/uploads
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh tokens
- `POST /api/auth/logout` - Logout

### Works

- `GET /api/works` - List works
- `POST /api/works` - Create work
- `GET /api/works/:id` - Get work
- `PATCH /api/works/:id` - Update work
- `DELETE /api/works/:id` - Delete work

### Public API

- `GET /api/public/works` - Public works listing
- `GET /api/public/homepage` - Homepage data

## Project Structure

```
api/
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Database migrations
│   └── seed.ts          # Seed script
├── src/
│   ├── index.ts         # Entry point
│   ├── config/          # Database & app config
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   └── utils/           # Helper functions
└── dist/                # Compiled output
```

## Database

### Prisma Commands

```bash
# Generate Prisma client
npx prisma generate

# Create a migration
npx prisma migrate dev --name migration_name

# Deploy migrations (production)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

## Production Deployment

### Build

```bash
npm run build
```

### Run

```bash
NODE_ENV=production node dist/index.js
```

### With PM2

```bash
pm2 start dist/index.js --name "platz-api"
```
