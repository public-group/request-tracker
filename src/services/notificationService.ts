import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_CONFIG } from '../constants';
import { Request } from '../types';
import { firebaseService } from './firebaseService';

async function sendEmail(payload: { to: string; subject: string; html: string; text: string }) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn('Server email endpoint returned error status:', res.status);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to connect to /api/send-email server route:', err);
  }
}

// Helper to load all users profiles
async function getEmailRecipients(): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching email recipients:', err);
    return [];
  }
}

export const notificationService = {
  async notifyTeamAssignment(request: Request) {
    // Email notifications have been removed
    return;
  },

  async notifyStatusChange(request: Request, oldStatus: string, newStatus: string) {
    // Email notifications have been removed
    return;
  },

  async notifyQaChange(request: Request, oldQa: string, newQa: string) {
    // Email notifications have been removed
    return;
  },

  async notifyNewComment(request: Request, comment: { author: string; text: string }) {
    // Email notifications have been removed
    return;
  }
};
