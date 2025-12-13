import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";

/**
 * Generic fetcher that excludes __placeholder__ documents.
 * @param {string} collectionName
 * @returns {Promise<Array>}
 */
export const fetchCollectionData = async (collectionName) => {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);

  return snapshot.docs
    .filter((doc) => doc.id !== "_placeholder_") 
    .map((doc) => ({ id: doc.id, ...doc.data() }));
};
