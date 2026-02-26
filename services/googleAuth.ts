import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export async function signInWithGoogle(): Promise<any> {
  const auth = getAuth();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    // The signed-in user info.
    const user = result.user;
    // You can also get the Google Access Token if needed:
    // const credential = GoogleAuthProvider.credentialFromResult(result);
    // const token = credential?.accessToken;
    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Google sign-in failed');
  }
}
