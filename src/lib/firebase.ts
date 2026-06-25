import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import staticConfig from '../../firebase-applet-config.json';

// Resolvendo as configurações do Firebase a partir de variáveis de ambiente com fallback para o arquivo local
const getEnvVal = (envVal: any, fallbackVal: string): string => {
  if (envVal === undefined || envVal === null) return fallbackVal;
  const str = String(envVal).trim();
  if (str === '' || str === 'undefined' || str === 'null') return fallbackVal;
  return str;
};

const firebaseConfig = {
  apiKey: getEnvVal(import.meta.env.VITE_FIREBASE_API_KEY, staticConfig.apiKey),
  authDomain: getEnvVal(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, staticConfig.authDomain),
  projectId: getEnvVal(import.meta.env.VITE_FIREBASE_PROJECT_ID, staticConfig.projectId),
  storageBucket: getEnvVal(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, staticConfig.storageBucket),
  messagingSenderId: getEnvVal(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, staticConfig.messagingSenderId),
  appId: getEnvVal(import.meta.env.VITE_FIREBASE_APP_ID, staticConfig.appId),
  measurementId: getEnvVal(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, staticConfig.measurementId),
  firestoreDatabaseId: getEnvVal(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID, staticConfig.firestoreDatabaseId),
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // Only throw if it is a permission-denied, security rules, or auth-related permissions error
  const isPermissionErr =
    errMessage.toLowerCase().includes('permission') ||
    errMessage.toLowerCase().includes('denied') ||
    errMessage.toLowerCase().includes('insufficient') ||
    (error && typeof error === 'object' && 'code' in error && String((error as any).code).toLowerCase().includes('permission'));

  if (isPermissionErr) {
    throw new Error(JSON.stringify(errInfo));
  }
}
