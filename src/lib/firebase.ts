import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBJ3MjAs_MRszfg_Y0JczR0qTaBlU3jSJs",
  authDomain: "color-trade-4a76f.firebaseapp.com",
  databaseURL: "https://color-trade-4a76f-default-rtdb.firebaseio.com",
  projectId: "color-trade-4a76f",
  storageBucket: "color-trade-4a76f.firebasestorage.app",
  messagingSenderId: "471311069473",
  appId: "1:471311069473:web:6cb1b046eb583dcf6d0e60",
  measurementId: "G-5JEC92Y294"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

export { app, auth, db, functions };
