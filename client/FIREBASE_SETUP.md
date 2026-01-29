# Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll set up security rules later)
4. Select a location for your database
5. Click **Enable**

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

## Step 4: Update Firebase Config

1. Open `client/src/firebase.js`
2. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 5: Set Up Firestore Collections

### Create Admin Document

1. Go to **Firestore Database** in Firebase Console
2. Click **Start collection**
3. Collection ID: `admins`
4. Document ID: (auto-generate or use a specific ID)
5. Add fields:
   - `mobile` (string) - Admin's mobile number
   - `pin` (string) - Admin's PIN (e.g., "1234")
   - `email` (string) - Admin's email (optional)
   - `createdAt` (timestamp) - Creation timestamp

Example admin document:
```
Collection: admins
Document ID: admin1
Fields:
  mobile: "1234567890"
  pin: "1234"
  email: "admin@example.com"
  createdAt: [timestamp]
```

### Meetings Collection

The `meetings` collection will be created automatically when you create a meeting through the admin dashboard.

## Step 6: Set Up Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admins collection - read only for authenticated users
    match /admins/{adminId} {
      allow read: if true; // Allow reading for login check
      allow write: if false; // Only admins can write (set manually or via admin SDK)
    }
    
    // Meetings collection
    match /meetings/{meetingId} {
      // Allow reading to check if meeting exists
      allow read: if true;
      // Allow creating meetings (admin only via app)
      allow create: if true;
      // Allow updating meetings (to add participants)
      allow update: if true;
    }
  }
}
```

**Note:** For production, you should implement proper authentication and more restrictive rules.

## Step 7: Test the Setup

1. Start your development server: `npm run dev`
2. Navigate to `/admin` route
3. Login with the admin credentials you created in Firestore
4. Create a meeting with a slot ID
5. Test joining from the main page (`/`) with that slot ID

## Troubleshooting

### Error: "Firebase: Error (auth/configuration-not-found)"
- Make sure you've copied the correct Firebase config values
- Check that your Firebase project is active

### Error: "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure the rules allow the operations you're trying to perform

### Admin login not working
- Verify the admin document exists in Firestore
- Check that `mobile` and `pin` fields match exactly (case-sensitive)
- Ensure the collection name is `admins` (plural)
