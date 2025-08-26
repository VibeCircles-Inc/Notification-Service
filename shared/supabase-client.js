const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Database interface for notifications
const db = {
  notifications: {
    create: async (notificationData) => {
      return await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();
    },
    
    getByUserId: async (userId, limit = 50) => {
      return await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    },
    
    markAsRead: async (notificationId, userId) => {
      return await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);
    },
    
    markAllAsRead: async (userId) => {
      return await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
    },
    
    delete: async (notificationId, userId) => {
      return await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);
    }
  },
  
  userSettings: {
    getById: async (userId) => {
      return await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
    },
    
    update: async (userId, settings) => {
      return await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settings
        })
        .select()
        .single();
    }
  },
  
  users: {
    getById: async (userId) => {
      return await supabase
        .from('users')
        .select('id, email, username, avatar_url')
        .eq('id', userId)
        .single();
    }
  }
};

module.exports = { db, supabase };
