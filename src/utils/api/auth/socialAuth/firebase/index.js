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

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    return {
      id: result.user.uid,
      email: result.user.email || '',
      access_token: credential?.accessToken || ''
    };
  } catch (error) {
    throw new Error(error?.message || 'Server error');
  }
}

/***************************  SOCIAL AUTH FIREBASE - LOGIN WITH FACEBOOK  ***************************/

export async function loginWithFacebook() {
  try {
    const result = await signInWithPopup(firebaseAuth, facebookProvider);
    const credential = FacebookAuthProvider.credentialFromResult(result);

    return {
      id: result.user.uid,
      email: result.user.email || '',
      access_token: credential?.accessToken || ''
    };
  } catch (error) {
    throw new Error(error?.message || 'Server error');
  }
}

/***************************  SOCIAL AUTH FIREBASE - GET USER  ***************************/

export function getUser() {
  return new Promise((resolve, reject) => {
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
  });
}

/***************************  SOCIAL AUTH FIREBASE - SIGN OUT  ***************************/

export async function signOut() {
  try {
    await firebaseAuth.signOut();
    return { status: 200 };
  } catch {
    throw new Error('Server error');
  }
}

// Export as a single object for easy import
const socialFirebaseAuth = { loginWithGoogle, loginWithFacebook, getUser, signOut };

export default socialFirebaseAuth;
