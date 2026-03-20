import { doc, setDoc, serverTimestamp, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';

const MEETINGS_COLLECTION = 'meetings';
const LOGS_SUBCOLLECTION = 'logs';

/**
 * Updates the participant's log document in Firestore.
 * Path: /meetings/{slotId}/logs/{participantId}
 */
export const updateParticipantLog = async (slotId, participantId, data) => {
    if (!slotId || !participantId) return;

    try {
        const logRef = doc(db, MEETINGS_COLLECTION, slotId, LOGS_SUBCOLLECTION, participantId);
        await setDoc(logRef, {
            ...data,
            lastUpdated: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('CRITICAL: Firestore Logging Failed!', error.code, error.message);
        // If it's a permission error, it's likely security rules
        if (error.code === 'permission-denied') {
            console.error('Action Required: Please update your Firestore Security Rules to allow writes to the "logs" sub-collection.');
        }
    }
};

/**
 * Listens for all participant logs for a given meeting slot.
 */
export const listenParticipantLogs = (slotId, callback) => {
    if (!slotId) return () => {};
    
    const logsRef = collection(db, MEETINGS_COLLECTION, slotId, LOGS_SUBCOLLECTION);
    
    return onSnapshot(logsRef, (snapshot) => {
        const logs = {};
        snapshot.forEach(doc => {
            logs[doc.id] = doc.data();
        });
        callback(logs);
    }, (error) => {
        console.error("Error listening to participant logs:", error);
    });
};
