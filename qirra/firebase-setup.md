# Firebase Setup for Qirra Online Multiplayer

To enable online multiplayer functionality in Qirra, you need to set up a Firebase project and configure the game with your Firebase credentials.

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "qirra-game")
4. Follow the setup wizard to create your project

## Step 2: Enable Required Services

### Enable Authentication
1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Anonymous" authentication (this is what the game uses)

### Enable Firestore Database
1. Go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" for now (you can secure it later)
4. Select a location for your database

### Enable Realtime Database
1. Go to "Realtime Database" in the left sidebar
2. Click "Create Database"
3. Choose "Start in test mode"
4. Select a location for your database

## Step 3: Get Your Firebase Configuration

1. In your Firebase project, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click "Add app" and select the web icon (`</>`)
5. Register your app with a nickname (e.g., "Qirra Web App")
6. Copy the Firebase configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## Step 4: Configure the Game

The game supports multiple ways to configure Firebase credentials for security:

### Option A: External Configuration File (Recommended for Development)

1. Copy your Firebase configuration values
2. Open `firebase-config.js` in a text editor
3. Replace the placeholder values with your actual Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyC...", // Your actual API key
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

4. **Important**: Add `firebase-config.js` to your `.gitignore` file to prevent committing credentials to version control

### Option B: Environment Variables (Recommended for Production)

1. Copy `.env.example` to `.env`
2. Fill in your actual Firebase values in the `.env` file:

```bash
FIREBASE_API_KEY=AIzaSyC...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

3. Use a build tool like Vite, Webpack, or Parcel to inject environment variables

### Option C: Runtime Injection (For Dynamic Configuration)

Set the configuration at runtime by defining a global variable before the game loads:

```html
<script>
window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyC...",
    authDomain: "your-project.firebaseapp.com",
    // ... other config values
};
</script>
<script type="module" src="index.html"></script>
```

## Step 5: Test the Setup

1. Open `index.html` in a web browser
2. If configured correctly, you should see:
   - "Ready to play online!" in the status
   - A number showing online players (should show at least 1 - you)
   - The "Find Match" button should be enabled

## Security Rules (Optional but Recommended)

For production use, you should secure your Firebase databases:

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/qirra-default/public/data/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Realtime Database Security Rules
```json
{
  "rules": {
    "status": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## Troubleshooting

- **"Offline mode only - Firebase not configured"**: Check that you've replaced all placeholder values in the Firebase config
- **Authentication errors**: Make sure Anonymous authentication is enabled in your Firebase project
- **Database errors**: Ensure both Firestore and Realtime Database are created and have appropriate rules
- **CORS errors**: Make sure you're serving the HTML file from a web server (not opening directly as a file)

## Testing Locally

For local testing, you can use a simple HTTP server:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have http-server installed)
npx http-server

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000/qirra/index.html` in your browser.
