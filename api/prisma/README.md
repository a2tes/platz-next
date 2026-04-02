# Database Setup and Management

This directory contains the Prisma schema, migrations, and seeding scripts for the CMS admin panel.

## Database Schema

The database schema includes the following main models:

### Core Models

- **User**: Admin users with role-based access control
- **MediaFile**: File storage with AWS S3 and Imgix integration
- **MediaFolder**: Hierarchical folder structure for media organization

### Content Models

- **Work**: Creative works

### System Models

- **Activity**: Activity tracking for audit trail
- **Session**: User session management
- **ApiKey**: API key management for external access
- **ContentPage**: Static content pages (About, Contact, Legal)

## Migration Commands

```bash
# Generate Prisma client
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

## Seeding

The database can be seeded with sample data for development:

```bash
# Run seed script
npm run db:seed

# Reset database and seed
npm run db:reset
```

### Seeded Data

The seed script creates:

- 2 test users (admin@example.com / admin123, editor@example.com / editor123)
- Sample media folders and files
- Sample works
- Sample content pages
- Sample activities and API keys

## Environment Variables

Make sure to set the following environment variables:

```env
DATABASE_URL="mysql://username:password@localhost:3306/database_name"
```

## Database Relationships

The schema includes the following key relationships:

- **MediaFile → MediaFolder**: Many-to-one relationship (hierarchical)
- **All content models → MediaFile**: Optional relationships for images/files
- **Activity → User**: Many-to-one relationship for audit trail

## Status and Publishing

Content models (Work, ContentPage) support:

- **Draft/Published status**: Content can be saved as draft before publishing
- **Publishing timestamps**: Automatic tracking of publication dates
- **Sort ordering**: Manual ordering for display purposes
- **SEO fields**: Meta description, keywords, and og:image support
