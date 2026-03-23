# Resources Folder

This folder contains application resources like logos and images.

## Logo Files

### Current Logo
- **Location**: `public/resources/images/bizom-logo.svg` (or `.png`)
- **Recommended Size**: 150-200px width, 40-60px height
- **Format**: PNG, SVG, or JPG

### How to Replace the Logo

1. **Prepare your logo file**:
   - Name it: `bizom-logo.png` or `bizom-logo.svg`
   - Recommended dimensions: 150-200px wide x 40-60px tall
   - Keep file size under 100KB for best performance

2. **Replace the file**:
   - Delete the existing `bizom-logo.svg` file
   - Copy your logo file to this folder: `public/resources/images/`
   - Name your file: `bizom-logo.png` (or keep as `.svg`)

3. **If using PNG/JPG instead of SVG**:
   - Open `public/index.html`
   - Find line with: `<img src="resources/images/bizom-logo.svg"`
   - Change to: `<img src="resources/images/bizom-logo.png"`

4. **Refresh your browser** - that's it!

### Supported Formats
- ✅ PNG (recommended for photo-realistic logos)
- ✅ SVG (recommended for scalable vector logos)
- ✅ JPG (acceptable but PNG preferred)

### Tips
- Use transparent background PNG for best results
- SVG files scale perfectly on all screen sizes
- Test on both light and dark backgrounds
# HR Hiring Dashboard - Dual Database Support

## 🎯 Overview

This application now supports **both SQLite (local development) and Firestore (production)** automatically!

- **Local Development**: Uses SQLite database (file-based, no setup required)
- **Production (Google Cloud)**: Uses Firestore (NoSQL, cloud-based)

The application automatically detects which database to use based on the environment.

## 🔐 Authentication

The application now includes **email-based authentication** to restrict access to authorized users only.

### How It Works

1. Users must log in with their email address
2. Only emails in the allowed list can access the dashboard
3. Sessions persist for 24 hours
4. All API endpoints are protected

### Configure Allowed Emails

**Method 1: Environment Variable (Recommended for Production)**

Set the `ALLOWED_EMAILS` environment variable with comma-separated email addresses:

```bash
export ALLOWED_EMAILS="john@company.com,jane@company.com,admin@company.com"
```

For Google Cloud deployment, set this in your deployment command:
```bash
gcloud run deploy hr-hiring-dashboard \
  --source . \
  --region us-central1 \
  --set-env-vars ALLOWED_EMAILS="john@company.com,jane@company.com"
```

**Method 2: Edit auth-config.js (For Local Development)**

Edit the `auth-config.js` file and add authorized emails:

```javascript
const ALLOWED_EMAILS = [
    'john.doe@example.com',
    'jane.smith@example.com',
    'admin@company.com',
];
```

### Session Security

- Sessions use secure, httpOnly cookies
- Session secret can be customized via `SESSION_SECRET` environment variable
- In production, cookies are automatically set to secure mode (HTTPS only)
- Default session duration: 24 hours

### Example .env Configuration

Create a `.env` file (copy from `.env.example`):

```bash
SESSION_SECRET=your-secure-random-secret-key
ALLOWED_EMAILS=user1@example.com,user2@example.com
NODE_ENV=development
```

## 🚀 Local Development

### Start the Server

```bash
npm install
npm start
```

The server will:
- ✅ Automatically use SQLite (local file: `database.db`)
- ✅ Run on http://localhost:3000
- ✅ No Google Cloud setup needed

### Your existing data is preserved!

All your existing SQLite data is still there and works as before.

## ☁️ Production Deployment

When you deploy to Google Cloud, the application automatically switches to Firestore.

### Environment Detection

The application uses Firestore when:
- `NODE_ENV=production` (automatically set by App Engine/Cloud Run)
- OR `USE_FIRESTORE=true` environment variable is set

### Quick Deploy Options

#### Option 1: Cloud Run (Recommended)
```bash
gcloud run deploy hr-hiring-dashboard --source . --region us-central1
```

#### Option 2: App Engine
```bash
gcloud app deploy
```

See detailed guides:
- [CLOUD_RUN_DEPLOYMENT.md](CLOUD_RUN_DEPLOYMENT.md) - Cloud Run deployment
- [DEPLOYMENT.md](DEPLOYMENT.md) - App Engine deployment
- [GOOGLE_CLOUD_MIGRATION.md](GOOGLE_CLOUD_MIGRATION.md) - Quick start guide

## 🔧 Testing Firestore Locally (Optional)

To test with Firestore locally:

```bash
# Set environment variable
export USE_FIRESTORE=true

# Also set your project ID
export GOOGLE_CLOUD_PROJECT=your-project-id

# Authenticate
gcloud auth application-default login

# Run the server
npm start
```

Or use the Firestore emulator (see deployment guides).

## 📊 Database Schema

Both databases use the same schema:

### Collections/Tables
- **jobs**: Job postings with status tracking
- **departments**: Available departments
- **roles**: Available job roles  
- **levels**: Job levels (e.g., L1, L2, Senior, etc.)

### Job Fields
```javascript
{
  id: "auto-generated",
  department: "Engineering",
  role: "Senior Developer",
  level: "L4",
  status: "Published|Offered|Joined|Rejected",
  posted_date: "2026-01-15",
  offered_date: "2026-02-20",
  expected_tat: 7,
  hr_name: "John Doe",
  created_at: "2026-01-15T10:00:00Z",  // Firestore only
  updated_at: "2026-02-20T15:30:00Z"   // Firestore only
}
```

## 🔄 How It Works

The server detects the environment and loads the appropriate database:

```javascript
// Automatically switches between databases
const USE_FIRESTORE = process.env.NODE_ENV === 'production' || 
                      process.env.USE_FIRESTORE === 'true';

if (USE_FIRESTORE) {
    // Uses Google Cloud Firestore
} else {
    // Uses SQLite (local file)
}
```

All API endpoints work identically regardless of which database is active!

## 📝 Development Workflow

1. **Develop locally** with SQLite (no setup needed)
2. **Test locally** with SQLite or Firestore emulator
3. **Deploy to Google Cloud** - automatically uses Firestore
4. **No code changes needed!**

## 🎉 Benefits

### Local Development (SQLite)
- ✅ No cloud setup required
- ✅ Works offline
- ✅ Fast and simple
- ✅ All existing data preserved
- ✅ No costs

### Production (Firestore)
- ✅ Scalable NoSQL database
- ✅ Real-time capabilities
- ✅ Automatic backups
- ✅ Global availability
- ✅ Free tier available

## 🔐 Port Configuration

The server uses:
- **Port 3000** for local development (localhost:3000)
- **Port from `process.env.PORT`** in production (automatically set by Cloud Run/App Engine)

## 📦 Dependencies

All dependencies are automatically managed:

```json
{
  "@google-cloud/firestore": "^7.1.0",  // Cloud NoSQL
  "sqlite3": "^5.1.7",                   // Local SQL
  "express": "^4.18.2",                  // Web framework
  "cors": "^2.8.5",                      // CORS support
  "multer": "^1.4.5-lts.1",             // File uploads
  "csv-parser": "^3.0.0",               // CSV parsing
  "json2csv": "^5.0.7"                  // CSV export
}
```

## 🚨 Important Notes

1. **SQLite data is NOT automatically migrated to Firestore**
   - You'll start with an empty database in production
   - Use the bulk upload feature to import data

2. **IDs are different**
   - SQLite: Numeric IDs (1, 2, 3, ...)
   - Firestore: String IDs (random auto-generated)

3. **Both databases work independently**
   - Changes in local SQLite don't affect production Firestore
   - Changes in production Firestore don't affect local SQLite

## 🎯 Quick Start

### For Local Development (Just Run It!)
```bash
npm start
```
Open http://localhost:3000

### For Production Deployment
```bash
# See GOOGLE_CLOUD_MIGRATION.md for detailed steps
gcloud run deploy hr-hiring-dashboard --source . --region us-central1
```

## 📚 Additional Documentation

- **[GOOGLE_CLOUD_MIGRATION.md](GOOGLE_CLOUD_MIGRATION.md)**: Quick start and overview
- **[CLOUD_RUN_DEPLOYMENT.md](CLOUD_RUN_DEPLOYMENT.md)**: Complete Cloud Run guide (recommended)
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Complete App Engine guide
- **[Dockerfile](Dockerfile)**: Container configuration for Cloud Run

## 🆘 Troubleshooting

### "Cannot find module '@google-cloud/firestore'"
```bash
npm install
```

### Server won't start
```bash
# Check if port 3000 is already in use
lsof -ti:3000 | xargs kill -9
npm start
```

### Want to force Firestore locally
```bash
export USE_FIRESTORE=true
export GOOGLE_CLOUD_PROJECT=your-project-id
gcloud auth application-default login
npm start
```

## ✨ What's Next?

1. ✅ Keep developing locally with SQLite
2. ✅ Deploy to Google Cloud when ready
3. ✅ No migration needed - both work side by side!

---

**You're all set!** The server now works both locally and in the cloud. 🎉
