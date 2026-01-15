# Torn Trading Spot

A full-stack application for managing Torn game items with admin authentication and public item display.

## Features

- **Public Page**: Browse all items from the database
- **Admin Panel**: Login with Torn API key to manage items
  - Sync items from Torn API
  - Edit custom descriptions and prices
- **Authentication**: Secure login with Torn API key verification
- **Rate Limiting**: Protection against brute force attacks (3 attempts per 50 seconds)

## Tech Stack

- **Frontend**: React with React Router
- **Backend**: Netlify Functions (serverless)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL database (Prisma Cloud or self-hosted)
- Torn API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd trading-spot
```

2. Install dependencies:
```bash
npm install
```

3. Configuration:
All configuration is hardcoded in the code - no environment variables needed!
- Database URL is hardcoded in `netlify/functions/_shared/prisma.js`
- JWT Secret is hardcoded in `netlify/functions/_shared/auth.js`

4. Database is already set up! The migration has been applied and the `items` table is created. If you need to regenerate the Prisma client:
```bash
npm run prisma:generate
```

5. Build the project:
```bash
npm run build
```

### Development

Run the development server:
```bash
npm run dev
```

This will start Netlify Dev which runs both the React app and Netlify Functions locally.

### Deployment to Netlify

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Connect your repository to Netlify:
   - Go to Netlify dashboard
   - Click "New site from Git"
   - Select your repository
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `build`

3. Deploy! No environment variables needed - everything is hardcoded.

## API Endpoints

### Public Endpoints

- `GET /.netlify/functions/get-items` - Get all items

### Protected Endpoints (Require Authentication)

- `GET /.netlify/functions/sync-items?key={API_KEY}` - Sync items from Torn API
- `PUT /.netlify/functions/update-item/:id` - Update item description and price
- `POST /.netlify/functions/auth-login` - Login with Torn API key

## Database Schema

The `Item` table contains:
- Torn API data (ID, UID, name, type, stats, etc.)
- Custom fields: `myDescription`, `myPrice`
- Timestamps: `createdAt`, `updatedAt`

## Security

- Rate limiting: 3 login attempts per 50 seconds per IP
- JWT token authentication for protected endpoints
- Torn API key verification (only user ID 2827691 allowed)

## License

MIT
