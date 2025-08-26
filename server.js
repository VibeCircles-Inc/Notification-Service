// Notification Service - Push notifications and alerts
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const { db } = require('../shared/supabase-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// Web Push configuration
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'notifications@vibecircles.com'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Email configuration
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Create notification record
async function createNotification(userId, type, title, message, data = {}) {
  try {
    const { data: notification, error } = await db.notifications.create({
      user_id: userId,
      type: type,
      title: title,
      message: message,
      data: data,
      read: false,
      created_at: new Date().toISOString()
    });

    if (error) throw error;
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// Get user notification preferences
async function getUserPreferences(userId) {
  try {
    const { data: settings, error } = await db.userSettings.getById(userId);
    if (error) throw error;
    
    return {
      push_enabled: settings?.push_enabled ?? true,
      email_enabled: settings?.email_enabled ?? true,
      sms_enabled: settings?.sms_enabled ?? false,
      push_subscription: settings?.push_subscription,
      email: settings?.email
    };
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return {
      push_enabled: true,
      email_enabled: true,
      sms_enabled: false
    };
  }
}

// Send push notification via Web Push API
async function sendPushNotification(subscription, payload) {
  try {
    const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true, statusCode: result.statusCode };
  } catch (error) {
    console.error('Push notification error:', error);
    return { success: false, error: error.message };
  }
}

// Send email notification
async function sendEmailNotification(email, subject, htmlContent) {
  try {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'notifications@vibecircles.com',
      to: email,
      subject: subject,
      html: htmlContent
    };

    const result = await emailTransporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email notification error:', error);
    return { success: false, error: error.message };
  }
}

// Send notification through multiple channels
async function sendNotification(userId, notification, channels = ['push']) {
  const preferences = await getUserPreferences(userId);
  const results = {};

  // Send push notification
  if (channels.includes('push') && preferences.push_enabled && preferences.push_subscription) {
    const payload = {
      title: notification.title,
      body: notification.message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: notification.data
    };

    results.push = await sendPushNotification(preferences.push_subscription, payload);
  }

  // Send email notification
  if (channels.includes('email') && preferences.email_enabled && preferences.email) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${notification.title}</h2>
        <p style="color: #666; line-height: 1.6;">${notification.message}</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
          <p style="margin: 0; color: #888; font-size: 12px;">
            Sent from VibeCircles - ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    `;

    results.email = await sendEmailNotification(
      preferences.email,
      notification.title,
      htmlContent
    );
  }

  return results;
}

// Routes

// Send notification endpoint
app.post('/send', authenticateToken, async (req, res) => {
  try {
    const { userId, type, title, message, data, channels = ['push'] } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create notification record
    const notification = await createNotification(userId, type, title, message, data);

    // Send through specified channels
    const results = await sendNotification(userId, notification, channels);

    res.json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        notification: notification,
        delivery_results: results
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      error: 'Failed to send notification',
      message: error.message
    });
  }
});

// Get user notifications
app.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, unread_only = false } = req.query;

    const offset = (page - 1) * limit;
    const filters = { user_id: userId };

    if (unread_only === 'true') {
      filters.read = false;
    }

    const { data: notifications, error } = await db.notifications.list(filters, {
      limit: parseInt(limit),
      offset: offset,
      orderBy: { created_at: 'desc' }
    });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        notifications: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          has_more: notifications.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: 'Failed to get notifications',
      message: error.message
    });
  }
});

// Mark notification as read
app.patch('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.user;

    const { data: notification, error } = await db.notifications.update(notificationId, {
      read: true,
      read_at: new Date().toISOString()
    });

    if (error) throw error;

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
});

// Mark all notifications as read
app.patch('/user/:userId/read-all', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await db.notifications.updateMany(
      { user_id: userId, read: false },
      { read: true, read_at: new Date().toISOString() }
    );

    if (error) throw error;

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      error: 'Failed to mark all notifications as read',
      message: error.message
    });
  }
});

// Update push subscription
app.post('/push-subscription', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({ error: 'Push subscription required' });
    }

    const { data, error } = await db.userSettings.update(userId, {
      push_subscription: subscription,
      push_enabled: true
    });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Push subscription updated'
    });

  } catch (error) {
    console.error('Update push subscription error:', error);
    res.status(500).json({
      error: 'Failed to update push subscription',
      message: error.message
    });
  }
});

// Update notification preferences
app.patch('/preferences', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { push_enabled, email_enabled, sms_enabled } = req.body;

    const updateData = {};
    if (push_enabled !== undefined) updateData.push_enabled = push_enabled;
    if (email_enabled !== undefined) updateData.email_enabled = email_enabled;
    if (sms_enabled !== undefined) updateData.sms_enabled = sms_enabled;

    const { data, error } = await db.userSettings.update(userId, updateData);

    if (error) throw error;

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Notification service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
