// @third-party
import { FacebookAuthProvider, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';

// @project
import { AuthRole } from '@/enum';
import { firebaseAuth } from '@/utils/auth-client/firebase';

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('public_profile');
facebookProvider.addScope('email');

/***************************  SOCIAL AUTH FIREBASE - LOGIN WITH GOOGLE  ***************************/

export function loginWithGoogle() {
  return new Promise((resolve, reject) => {
    try {
      signInWithPopup(firebaseAuth, googleProvider)
        .then((result) => {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          resolve({
          resolve({
            id: result.user.uid,
            email: result.user.email || '',
            access_token: credential?.accessToken || ''
    } catch {
        })
        .catch((error) => {
          reject(new Error(error.message));
        });
    } catch {
      reject(new Error('Server error'));
    }

/***************************  SOCIAL AUTH FIREBASE - LOGIN WITH FACEBOOK  ***************************/

export function loginWithFacebook() {
  return new Promise((resolve, reject) => {
    try {
      signInWithPopup(firebaseAuth, facebookProvider)
    try {
      signInWithPopup(firebaseAuth, facebookProvider)
        .then((result) => {
          const credential = FacebookAuthProvider.credentialFromResult(result);
            email: result.user.email || '',
          resolve({
            id: result.user.uid,
            email: result.user.email || '',
            access_token: credential?.accessToken || ''
    }
        })
        .catch((error) => {
          reject(new Error(error.message));
        });
    } catch {
      reject(new Error('Server error'));
    }

export function getUser() {
  return new Promise((resolve, reject) => {
    try {
      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          resolve({
    try {
      onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          resolve({
            id: user.uid,
            email: user.email || '',
            role: AuthRole.USER,
            contact: '123456789',
            dialcode: '+1',
            firstname: 'John',
            lastname: 'Charly'
          });
        } else {
          reject(new Error('No user is signed in.'));
        }
      });
    } catch {
      reject(new Error('Server error'));
    }
  return new Promise((resolve, reject) => {
    try {
      firebaseAuth
        .signOut()
        .then(() => {
          resolve({ status: 200 });
        })
    try {
      firebaseAuth
        .signOut()
        .then(() => {
          resolve({ status: 200 });
        })
        .catch(() => {
          reject(new Error('Server error'));
        });
    } catch {
      reject(new Error('Server error'));
    }

// Export as a single object for easy import
const socialFirebaseAuth = { loginWithGoogle, loginWithFacebook, getUser, signOut };

export default socialFirebaseAuth;
