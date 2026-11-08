// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// ถ้าใช้ Firestore, Realtime Database ฯลฯ ก็ import เพิ่ม
// import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA33ARv6ahHXA5-Yrva3z35wnLNUR5ziRE",
  authDomain: "echair-7bf50.firebaseapp.com",
  projectId: "echair-7bf50",
  storageBucket: "echair-7bf50.firebasestorage.app",
  messagingSenderId: "300252722266",
  appId: "1:300252722266:web:1b273af8c055e390b7d463",
  measurementId: "G-MS26CBV3HK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
// ถ้าใช้ Firestore
// export const db = getFirestore(app);

export default app;
