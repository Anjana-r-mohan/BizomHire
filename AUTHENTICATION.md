# Authentication Setup Guide

This guide will help you set up email-based authentication for the HR Hiring Dashboard.

## Overview

The authentication system stores authorized users in the database (SQLite locally, Firestore in production), making it easy to manage access through the admin UI - similar to how Postman handles team invites.

## Quick Setup (3 Steps)

### Step 1: Add Your Initial Users

Edit `add-initial-users.js` and add your email address:

```javascript
const INITIAL_USERS = [
    { email: 'your.email@company.com', name: 'Your Name', role: 'admin' },
    { email: 'colleague@company.com', name: 'Colleague Name', role: 'user' },
];
```

Then run:
```bash
node add-initial-users.js
```

### Step 2: Start the Server

```bash
npm start
```

### Step 3: Login and Manage Users

1. Open http://localhost:3000
2. Login with your authorized email
3. Access the dashboard
4. Go to "🔐 Manage Authorized Users" section at the bottom
5. Invite new users by entering their email addresses

## Features

✅ **Database-backed authentication** - Users stored in SQLite/Firestore
✅ **Admin UI for user management** - Invite users directly from the dashboard
✅ **Invite system** - Similar to Postman's team invites
✅ **Track invitations** - See who invited each user and when
✅ **Session management** - Stay logged in for 24 hours
✅ **No passwords needed** - Email-only authentication
✅ **Protected API** - All endpoints require authentication
✅ **Works with both databases** - SQLite for local, Firestore for production

## Managing Users

### From the Admin UI (Recommended)

1. Log in to the dashboard
2. Scroll to the bottom
3. Click "🔐 Manage Authorized Users"
4. Enter the email address (and optionally name)
5. Click "Invite User"
6. The user can now log in immediately!

### View All Users

The admin UI shows:
- Email address
- Name (if provided)
- Status (Active/Inactive)
- Who invited them
- When they were invited

### Remove Users

Click "Remove" next to any user to revoke their access. They won't be able to log in anymore.

## Database Schema

### authorized_users table/collection:

```javascript
{
  id: "auto-generated",
  email: "user@company.com",           // Lowercase, unique
  name: "User Name",                   // Optional
  role: "user" | "admin",              // Future use
  status: "active" | "inactive",       // Active can login
  invited_by: "admin@company.com",     // Who invited them
  invited_at: "2026-03-23T10:00:00Z",  // When invited
  created_at: "2026-03-23T10:00:00Z"   // Record created
}
```

## Testing the Authentication

1. **Test with authorized email:**
   - Add your email using the script or admin UI
   - Try logging in - should succeed
   - Access the dashboard

2. **Test with unauthorized email:**
   - Try logging in with an email NOT in the database
   - Should see: "Access denied" error message

3. **Test inviting new users:**
   - Log in with your account
   - Go to "Manage Authorized Users"
   - Add a new email address
   - Try logging in with that email - should work!

4. **Test removing users:**
   - Remove a user from the list
   - Try logging in with that email - should be denied

5. **Test session persistence:**
   - Log in successfully
   - Close the browser
   - Reopen http://localhost:3000
   - Should still be logged in (for 24 hours)

6. **Test logout:**
   - Click the "Logout" button in the header
   - Should be redirected to login page
   - Try accessing the dashboard - should redirect to login

## Production Deployment

The user database is automatically created in Firestore when you deploy to Google Cloud.

### Google Cloud Run

```bash
gcloud run deploy hr-hiring-dashboard \
  --source . \
  --region us-central1 \
  --set-env-vars SESSION_SECRET="$(openssl rand -base64 32)"
```

### Google App Engine

Update `app.yaml`:

```yaml
env_variables:
  SESSION_SECRET: "your-secure-random-key-here"
  NODE_ENV: "production"
```

Then deploy:
```bash
gcloud app deploy
```

### Adding Initial Users in Production

**Option 1: Use the Admin UI (Best)**
1. Temporarily add your email to the `add-initial-users.js` script
2. Run it locally before deploying: `node add-initial-users.js`
3. This creates the user in your local database
4. Deploy to production
5. Manually add the first user to Firestore via Google Cloud Console
6. Log in and use the admin UI to invite others

**Option 2: Use Google Cloud Console**
1. Go to Firestore in Google Cloud Console
2. Create collection: `authorized_users`
3. Add a document with:
   ```json
   {
     "email": "your.email@company.com",
     "name": "Your Name",
     "role": "admin",
     "status": "active",
     "invited_at": "[current date]"
   }
   ```
4. Log in and use the admin UI to manage users

**Option 3: Cloud Function or Script**
Create a one-time script to add the first admin user to Firestore.

Update `app.yaml`:

```yaml
env_variables:
  ALLOWED_EMAILS: "email1@company.com,email2@company.com"
  SESSION_SECRET: "your-secure-random-key-here"
  NODE_ENV: "production"
```

Then deploy:
```bash
gcloud app deploy
```

## Security Best Practices

1. **Set a strong SESSION_SECRET in production:**
   ```bash
   export SESSION_SECRET="$(openssl rand -base64 32)"
   ```

2. **Use environment variables** instead of hardcoding emails

3. **Use HTTPS in production** (automatic with Cloud Run/App Engine)

4. **Review allowed emails regularly** and remove inactive users

5. **Monitor access logs** for suspicious activity

## Troubleshooting

### "Access denied" for authorized email

- Check if email is exactly spelled in the allowed list (case-insensitive)
- Make sure there are no extra spaces
- Restart the server after changing `auth-config.js`

### Session expires too quickly

Change session duration in `server.js`:

```javascript
cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days instead of 24 hours
}
```

### Can't access after deployment

- Verify `ALLOWED_EMAILS` environment variable is set correctly in cloud
- Check cloud logs: `gcloud run logs tail`
- Ensure no firewall/VPC blocking access

### Need to add many users

Create a `.env` file with comma-separated emails:

```bash
ALLOWED_EMAILS="user1@company.com,user2@company.com,user3@company.com,user4@company.com"
```

## API Authentication

All API endpoints now require authentication. Include session cookies in requests:

```javascript
// Fetch with credentials
fetch('/jobs', {
    credentials: 'include'  // Include session cookie
})
```

## Files Modified

- ✅ `server.js` - Added session middleware and auth routes
- ✅ `auth-config.js` - Configuration for allowed emails (NEW)
- ✅ `public/login.html` - Login page (NEW)
- ✅ `public/app.js` - Added auth check and logout
- ✅ `public/index.html` - Added logout button
- ✅ `.env.example` - Environment variables template (NEW)
- ✅ `package.json` - Added express-session dependency
- ✅ `README.md` - Updated with authentication info

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check server logs for authentication failures
3. Verify environment variables are set correctly
4. Try clearing browser cookies and logging in again

---

**You're all set!** Your dashboard is now protected with email-based authentication. 🔒
