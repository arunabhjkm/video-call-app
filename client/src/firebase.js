import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDsge-TPFVIxE1yopZK2YRwAzmk0OLU3Ag",
  authDomain: "web-rtc-362e0.firebaseapp.com",
  projectId: "web-rtc-362e0",
  storageBucket: "web-rtc-362e0.firebasestorage.app",
  messagingSenderId: "272786511368",
  appId: "1:272786511368:web:2fef1adbeb4499d26623bd",
  measurementId: "G-OGXDQQP55S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth (if needed for future authentication)
export const auth = getAuth(app);

export default app;
