# 🚀 Quick Start - Database-Based Authentication

## Get Started in 3 Easy Steps

### Step 1: Add Yourself as an Authorized User

Edit `add-initial-users.js` and replace the example email with yours:

```javascript
const INITIAL_USERS = [
    { email: 'YOUR-EMAIL@company.com', name: 'Your Name', role: 'admin' },
];
```

Then run:
```bash
node add-initial-users.js
```

You should see:
```
✅ Added: YOUR-EMAIL@company.com (Your Name)
✅ Done! You can now log in with the authorized emails.
```

### Step 2: Start the Server

```bash
npm start
```

### Step 3: Login and Invite Others

1. Open http://localhost:3000
2. Enter your email address
3. Click "Sign In"
4. Welcome to the dashboard! 🎉

## Inviting More Users

Once logged in, you can invite team members:

1. Scroll to the bottom of the dashboard
2. Click on **"🔐 Manage Authorized Users"**
3. Enter their email address (and optionally their name)
4. Click **"Invite User"**
5. They can now log in immediately!

## What's Different Now?

✅ **No hardcoded emails** - Everything is in the database
✅ **Easy user management** - Invite users from the UI
✅ **Track invitations** - See who invited whom and when
✅ **Just like Postman** - Simple invite-based access control
✅ **Works everywhere** - SQLite locally, Firestore in production

## Viewing All Authorized Users

In the "Manage Authorized Users" section, you'll see:
- 📧 Email address
- 👤 Name
- ✅ Status (Active/Inactive)
- 👥 Who invited them
- 📅 When they were invited
- 🗑️ Remove button

## Removing Access

Click the "Remove" button next to any user to revoke their access. They won't be able to log in anymore.

## Need Help?

- See [AUTHENTICATION.md](AUTHENTICATION.md) for detailed documentation
- Check [README.md](README.md) for general information

---

**That's it!** You're ready to use the dashboard with database-backed authentication. 🎉
