import { db } from "../firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { fetchCollectionData } from "./firestoreHelpers.js";
import { deleteAllDocsExceptPlaceholder } from "./firestoreUtils.js";

const COLLECTION_NAME = "emigrants_sex";
const emigrantsCollection = collection(db, COLLECTION_NAME);

//ADD DATA
export const addEmigrant = async (data) => {
  await addDoc(emigrantsCollection, data);
};

//READ DATA
export const getEmigrants = async () => {
  return await fetchCollectionData(COLLECTION_NAME);
};

//UPDATE DATA
export const updateEmigrant = async (id, data) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, data);
};

//DELETE DATA
export const deleteEmigrant = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
};

//DELETE ALL
export const deleteAllEmigrants = async () => {
  await deleteAllDocsExceptPlaceholder(COLLECTION_NAME);
};
