# Notification Service

Push notifications and alerts service for VibeCircles.

## Features

- Push notifications via Web Push API
- Email notifications via SMTP
- SMS notifications (optional via Twilio)
- Real-time notification delivery
- User preference management
- Rate limiting and security

## Setup

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3004
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Web Push Configuration (VAPID Keys)
VAPID_EMAIL=notifications@vibecircles.com
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# SMTP Configuration for Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Optional: SMS Configuration (if using Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

- `POST /notifications/send` - Send a notification
- `GET /notifications/:userId` - Get user notifications
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/:userId/read-all` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete a notification
- `POST /notifications/subscribe` - Subscribe to push notifications
- `PUT /notifications/preferences` - Update notification preferences

## Railway Deployment

This service is configured for Railway deployment. The `package.json` file includes all necessary dependencies and the start script for production deployment.
