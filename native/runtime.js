import * as app from 'firebase/app';
import * as auth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { Clipboard } from '@capacitor/clipboard';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { signInNativeGoogle, GOOGLE_CONFIGURATION_MESSAGE } from './signin.js';

window.__hecagusNative = {
  firebaseModules: [app, auth, firestore],
  googleConfigured: __GOOGLE_CONFIGURED__,
  googleConfigurationMessage: GOOGLE_CONFIGURATION_MESSAGE,
  copyBackup: json => Clipboard.write({string:json}),
  signInWithGoogle: (sdk, session) => signInNativeGoogle({
    sdk, session, plugin: FirebaseAuthentication, configured: __GOOGLE_CONFIGURED__
  })
};
