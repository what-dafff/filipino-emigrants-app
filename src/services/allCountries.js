import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fetchCollectionData } from "./firestoreHelpers.js";
import { deleteAllDocsExceptPlaceholder } from "./firestoreUtils.js";

const COLLECTION_NAME = "emigrants_allCountries";
const emigrantsCollection = collection(db, COLLECTION_NAME);

// CREATE
export const addEmigrant = async (data) => {
  await addDoc(emigrantsCollection, data);
};

// READ
export const getEmigrants = async () => {
  return await fetchCollectionData(COLLECTION_NAME);
};

// UPDATE
export const updateEmigrant = async (id, data) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, data);
};

// DELETE
export const deleteEmigrant = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};

// BULK DELETE
export const deleteAllEmigrants = async () => {
  await deleteAllDocsExceptPlaceholder(COLLECTION_NAME);
};
