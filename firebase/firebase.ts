import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDW-Gp2N9AuRTXeLk-9vgEQTFg1PyHMMxE",
  authDomain: "dealzora-3c8e3.firebaseapp.com",
  projectId: "dealzora-3c8e3",
  storageBucket: "dealzora-3c8e3.firebasestorage.app",
  messagingSenderId: "245061792587",
  appId: "1:245061792587:web:ee28be9c86b4d79db8aece",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
