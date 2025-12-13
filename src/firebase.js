import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXtIjrCQERiLZW97s-TJczLtjL94QEYYQ",
  authDomain: "filipinoemigrantsdb-d763b.firebaseapp.com",
  projectId: "filipinoemigrantsdb-d763b",
  storageBucket: "filipinoemigrantsdb-d763b.firebasestorage.app",
  messagingSenderId: "127436828305",
  appId: "1:127436828305:web:6885828f90ca4f0d735930",
  measurementId: "G-80DBYLNKXR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
