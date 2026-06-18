import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  type User as FirebaseUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            "AIzaSyDPPTaj6IMoijf2fecDR7bHYYyUs3myz7E",
  authDomain:        "compass-planning.firebaseapp.com",
  projectId:         "compass-planning",
  storageBucket:     "compass-planning.firebasestorage.app",
  messagingSenderId: "1099371674702",
  appId:             "1:1099371674702:web:de4f9657fdd170ab07571f",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  type FirebaseUser,
};
