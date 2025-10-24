import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKELPJvUJVLTstKAkrzitB8SYfzmFU5xM",
  authDomain: "Dealzora-a05dd.firebaseapp.com",
  projectId: "Dealzora-a05dd",
  storageBucket: "Dealzora-a05dd.firebasestorage.app",
  messagingSenderId: "212863598015",
  appId: "1:212863598015:web:decdf8bdd5c69c615af50a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
