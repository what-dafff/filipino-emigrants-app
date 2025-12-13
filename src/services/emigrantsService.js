import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const emigrantsCollection = collection(db, "emigrants");

// CREATE
export const addEmigrant = async (data) => {
  await addDoc(emigrantsCollection, data);
};

// READ
export const getEmigrants = async () => {
  const snapshot = await getDocs(emigrantsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// UPDATE
export const updateEmigrant = async (id, data) => {
  const docRef = doc(db, "emigrants", id);
  await updateDoc(docRef, data);
};

// DELETE
export const deleteEmigrant = async (id) => {
  const docRef = doc(db, "emigrants", id);
  await deleteDoc(docRef);
};

// BULK DELETE
export const deleteAllEmigrants = async (ids) => {
  const promises = ids.map(id => {
    const docRef = doc(db, "emigrants", id);
    return deleteDoc(docRef);
  });
  await Promise.all(promises);
};