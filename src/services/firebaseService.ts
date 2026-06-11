import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  getDoc,
  setDoc,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { 
  auth, 
  db 
} from '../lib/firebase';
import { Request, RequestStatus, QAStatus } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  const jsonError = JSON.stringify(errInfo);
  console.error('[FirebaseService] Firestore Error:', jsonError);
  throw new Error(jsonError);
}

export const firebaseService = {
  // --- Requests ---
  
  async getRequests(): Promise<Request[]> {
    const path = 'requests';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Request));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeRequests(callback: (requests: Request[]) => void) {
    const path = 'requests';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Request));
      callback(requests);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async addRequest(requestData: Omit<Request, 'id'>): Promise<string> {
    const requestsPath = 'requests';
    try {
      return await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'metadata', 'requests');
        const counterSnap = await transaction.get(counterRef);
        
        let lastId = 0;
        if (counterSnap.exists()) {
          lastId = counterSnap.data().lastId || 0;
        }
        
        const nextId = lastId + 1;
        const formattedId = `REQ-${nextId.toString().padStart(4, '0')}`;
        const newRequestRef = doc(collection(db, requestsPath));
        
        const payload = {
          ...requestData,
          requestId: formattedId, 
          userId: auth.currentUser?.uid,
        };

        transaction.set(newRequestRef, payload);
        transaction.set(counterRef, { lastId: nextId }, { merge: true });
        
        return newRequestRef.id;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, requestsPath);
      return '';
    }
  },

  async resetAllRequests(): Promise<void> {
    const requestsPath = 'requests';
    try {
      const snapshot = await getDocs(collection(db, requestsPath));
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      const counterRef = doc(db, 'metadata', 'requests');
      batch.set(counterRef, { lastId: 0 }, { merge: true });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, requestsPath);
    }
  },

  async updateRequest(request: Request): Promise<void> {
    const path = `requests/${request.id}`;
    try {
      const { id, ...data } = request;
      const ref = doc(db, 'requests', id);
      await updateDoc(ref, {
        ...data,
        updateDate: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteRequest(id: string): Promise<void> {
    const path = `requests/${id}`;
    try {
      await deleteDoc(doc(db, 'requests', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- User Profiles ---
  
  async getUserProfile(uid: string) {
    const path = `users/${uid}`;
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async createUserProfile(uid: string, profile: { name: string, email: string, role: string, status: string, mappedOwner?: string }) {
    const path = `users/${uid}`;
    try {
      await setDoc(doc(db, 'users', uid), { mappedOwner: '', ...profile });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getAllUsers(): Promise<any[]> {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async updateUserStatus(uid: string, status: 'approved' | 'rejected'): Promise<void> {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      await updateDoc(ref, { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateUserRole(uid: string, role: string): Promise<void> {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      await updateDoc(ref, { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateUserMappedOwner(uid: string, mappedOwner: string): Promise<void> {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      await updateDoc(ref, { mappedOwner });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateUserNotificationSettings(uid: string, notificationSettings: {
    emailEnabled: boolean;
    notifyTeamAssignment: boolean;
    notifyStatusChange: boolean;
    notifyQaChange: boolean;
    notifyNewComment: boolean;
  }): Promise<void> {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      await updateDoc(ref, { notificationSettings });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteUserProfile(uid: string): Promise<void> {
    const path = `users/${uid}`;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async updateUserPins(uid: string, pinnedRequestIds: string[]): Promise<void> {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      await updateDoc(ref, { pinnedRequestIds });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeUsers(callback: (users: any[]) => void) {
    const path = 'users';
    return onSnapshot(collection(db, path), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeUserProfile(uid: string, callback: (profile: any | null) => void) {
    const path = `users/${uid}`;
    return onSnapshot(doc(db, 'users', uid), (snapshot) => {
      if (snapshot.exists()) {
        callback({ uid: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  // --- Authorized Emails (Invites) ---

  async getAuthorizedEmail(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const path = `authorized_emails/${cleanEmail}`;
    try {
      const docSnap = await getDoc(doc(db, 'authorized_emails', cleanEmail));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async addAuthorizedEmail(email: string, role: string) {
    const cleanEmail = email.trim().toLowerCase();
    const path = `authorized_emails/${cleanEmail}`;
    try {
      await setDoc(doc(db, 'authorized_emails', cleanEmail), { email: cleanEmail, role, mappedOwner: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteAuthorizedEmail(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const path = `authorized_emails/${cleanEmail}`;
    try {
      await deleteDoc(doc(db, 'authorized_emails', cleanEmail));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async updateAuthorizedEmail(email: string, role: string) {
    const cleanEmail = email.trim().toLowerCase();
    const path = `authorized_emails/${cleanEmail}`;
    try {
      const ref = doc(db, 'authorized_emails', cleanEmail);
      await updateDoc(ref, { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateAuthorizedEmailMappedOwner(email: string, mappedOwner: string) {
    const cleanEmail = email.trim().toLowerCase();
    const path = `authorized_emails/${cleanEmail}`;
    try {
      const ref = doc(db, 'authorized_emails', cleanEmail);
      await updateDoc(ref, { mappedOwner });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeAuthorizedEmails(callback: (emails: any[]) => void) {
    const path = 'authorized_emails';
    return onSnapshot(collection(db, path), (snapshot) => {
      const emails = snapshot.docs.map(doc => ({ uid: `auth-${doc.id}`, isAuthorizedEmail: true, ...doc.data() }));
      callback(emails);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // --- Logs ---

  async addLog(log: { action: string, details?: string, requestId?: string, userName?: string }): Promise<void> {
    const path = 'logs';
    try {
      const user = auth.currentUser;
      if (!user) return;

      const logEntry = {
        userId: user.uid,
        userName: log.userName || user.displayName || user.email || 'Anonymous',
        action: log.action,
        timestamp: new Date().toISOString(),
        details: log.details || '',
        requestId: log.requestId || ''
      };

      await addDoc(collection(db, path), logEntry);
    } catch (error) {
      console.error('[FirebaseService] Logging error:', error);
    }
  },

  async getLogs(): Promise<any[]> {
    const path = 'logs';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeLogs(callback: (logs: any[]) => void) {
    const path = 'logs';
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async clearLogs(): Promise<void> {
    const path = 'logs';
    try {
      const snapshot = await getDocs(collection(db, path));
      const totalDocs = snapshot.docs.length;
      
      if (totalDocs === 0) return;

      // Firestore writeBatch has a limit of 500 operations
      const BATCH_LIMIT = 500;
      for (let i = 0; i < totalDocs; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
        chunk.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- App Config ---

  async getAppConfig(): Promise<any | null> {
    const path = 'metadata/app_config';
    try {
      const snap = await getDoc(doc(db, 'metadata', 'app_config'));
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async updateAppConfig(config: any): Promise<void> {
    const path = 'metadata/app_config';
    try {
      await setDoc(doc(db, 'metadata', 'app_config'), config);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeAppConfig(callback: (config: any | null) => void) {
    const path = 'metadata/app_config';
    return onSnapshot(doc(db, 'metadata', 'app_config'), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  }
};
