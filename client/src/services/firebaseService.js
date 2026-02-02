import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  arrayRemove,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';

// Admin collection name
const ADMIN_COLLECTION = 'admins';
const MEETINGS_COLLECTION = 'meetings';

/**
 * Authenticate admin with mobile and PIN
 */
export const authenticateAdmin = async (mobile, pin) => {
  try {
    const adminQuery = query(
      collection(db, ADMIN_COLLECTION),
      where('mobile', '==', mobile),
      where('pin', '==', pin)
    );

    const querySnapshot = await getDocs(adminQuery);

    if (!querySnapshot.empty) {
      const adminDoc = querySnapshot.docs[0];
      return {
        success: true,
        adminId: adminDoc.id,
        adminData: adminDoc.data()
      };
    } else {
      return {
        success: false,
        error: 'Invalid mobile number or PIN'
      };
    }
  } catch (error) {
    console.error('Error authenticating admin:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create a new meeting with slot ID
 */
export const createMeeting = async (slotId, adminEmail) => {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, slotId);
    const meetingDoc = await getDoc(meetingRef);

    // Check if meeting already exists
    if (meetingDoc.exists()) {
      return {
        success: false,
        error: 'Meeting with this slot ID already exists'
      };
    }

    // Create new meeting
    const meetingData = {
      slotId: slotId,
      roomID: slotId, // Use slotId as roomID
      adminEmail: adminEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'pending', // Initial status is pending
      endsAt: null,
      participants: [],
      createdBy: adminEmail
    };

    await setDoc(meetingRef, meetingData);

    return {
      success: true,
      meetingId: slotId,
      meetingData: meetingData
    };
  } catch (error) {
    console.error('Error creating meeting:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if a meeting/slot ID exists
 */
export const checkMeetingExists = async (slotId) => {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, slotId);
    const meetingDoc = await getDoc(meetingRef);

    if (meetingDoc.exists()) {
      const meetingData = meetingDoc.data();
      return {
        exists: true,
        meetingData: meetingData,
        status: meetingData.status || 'pending',
        isActive: meetingData.status === 'active'
      };
    } else {
      return {
        exists: false,
        error: 'Meeting not found'
      };
    }
  } catch (error) {
    console.error('Error checking meeting:', error);
    return {
      exists: false,
      error: error.message
    };
  }
};

/**
 * Update meeting when participant joins
 */
export const addParticipantToMeeting = async (slotId, participantId, participantName = 'Guest') => {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, slotId);
    const meetingDoc = await getDoc(meetingRef);

    if (!meetingDoc.exists()) {
      return {
        success: false,
        error: 'Meeting not found'
      };
    }

    const meetingData = meetingDoc.data();
    const participants = meetingData.participants || [];

    // Check if participant is already in list (by ID)
    let isPresent = false;
    // Handle legacy array of strings if necessary, though we prefer objects now
    if (participants.length > 0 && typeof participants[0] === 'string') {
      if (participants.includes(participantId)) isPresent = true;
    } else {
      if (participants.some(p => p.id === participantId)) isPresent = true;
    }

    // Add participant if not already in list
    if (!isPresent) {
      // Use arrayUnion with the new object structure
      const newParticipant = { id: participantId, name: participantName, joinedAt: new Date().toISOString() };

      console.log(`Adding participant ${participantId} (${participantName}) to slot ${slotId}`);
      await updateDoc(meetingRef, {
        participants: arrayUnion(newParticipant),
        updatedAt: serverTimestamp()
      });
      console.log("Participant added successfully");
    } else {
      console.log("Participant already present");
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error adding participant:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Remove participant from meeting
 */
export const removeParticipantFromMeeting = async (slotId, participantId) => {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, slotId);
    const meetingDoc = await getDoc(meetingRef);

    if (meetingDoc.exists()) {
      const data = meetingDoc.data();
      let participants = data.participants || [];
      const initialLength = participants.length;

      // Filter out the participant by ID
      participants = participants.filter(p => {
        if (typeof p === 'string') return p !== participantId;
        return p.id !== participantId;
      });

      if (participants.length !== initialLength) {
        await updateDoc(meetingRef, {
          participants: participants,
          updatedAt: serverTimestamp()
        });
      }
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error removing participant:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all meetings created by an admin
 */
export const getAdminMeetings = async (adminEmail) => {
  try {
    const meetingsQuery = query(
      collection(db, MEETINGS_COLLECTION),
      where('adminEmail', '==', adminEmail)
    );

    const querySnapshot = await getDocs(meetingsQuery);
    const meetings = [];

    querySnapshot.forEach((doc) => {
      meetings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      meetings: meetings
    };
  } catch (error) {
    console.error('Error getting admin meetings:', error);
    return {
      success: false,
      error: error.message,
      meetings: []
    };
  }
};

/**
 * Listen to all meetings for an admin in real time
 */
export const listenAdminMeetings = (adminEmail, callback) => {
  try {
    const meetingsQuery = query(
      collection(db, MEETINGS_COLLECTION),
      where('adminEmail', '==', adminEmail)
    );

    return onSnapshot(
      meetingsQuery,
      (snapshot) => {
        const meetings = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        callback({
          success: true,
          meetings,
        });
      },
      (error) => {
        console.error('Error listening to admin meetings:', error);
        callback({
          success: false,
          error: error.message,
          meetings: [],
        });
      }
    );
  } catch (error) {
    console.error('Error setting up admin meetings listener:', error);
    callback({
      success: false,
      error: error.message,
      meetings: [],
    });
    return () => { };
  }
};

/**
 * Update meeting status and optional end time
 */
export const updateMeetingStatus = async (slotId, status, endsAt = null) => {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, slotId);
    await updateDoc(meetingRef, {
      status: status,
      endsAt: endsAt ? new Date(endsAt) : null,
      updatedAt: serverTimestamp()
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error updating meeting status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Set a meeting timer in minutes
 */
export const setMeetingTimer = async (slotId, minutes) => {
  try {
    const durationMs = minutes * 60 * 1000;
    const endsAtDate = new Date(Date.now() + durationMs);
    return await updateMeetingStatus(slotId, 'active', endsAtDate);
  } catch (error) {
    console.error('Error setting meeting timer:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Listen for meeting changes (status/timer)
 */
export const listenMeetingChanges = (slotId, callback) => {
  const meetingRef = doc(db, MEETINGS_COLLECTION, slotId);
  return onSnapshot(meetingRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ exists: true, data: docSnap.data() });
    } else {
      callback({ exists: false });
    }
  }, (error) => {
    console.error('Error listening to meeting changes:', error);
    callback({ exists: false, error });
  });
};
