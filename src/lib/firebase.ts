import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyAyi2toOVWQGTXyIHgOlzUY46b48IA09B4",
  authDomain: "game-b8a5c.firebaseapp.com",
  projectId: "game-b8a5c",
  storageBucket: "game-b8a5c.firebasestorage.app",
  messagingSenderId: "544937853903",
  appId: "1:544937853903:web:33a9838e1098850e9908ba",
  measurementId: "G-M6KW1RHBM8",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
