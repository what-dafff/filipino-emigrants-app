import { db } from "../firebase.js";
import { collection, getDocs, deleteDoc, doc, setDoc } from "firebase/firestore";

export const deleteAllDocsExceptPlaceholder = async (collectionName) => {
  const colRef = collection(db, collectionName);
  const placeholderRef = doc(colRef, "_placeholder_");

  await setDoc(placeholderRef, {
    note: "This is a placeholder document to keep the collection alive.",
    protected: true,
  }, { merge: true });

  const snapshot = await getDocs(colRef);

  const deletePromises = snapshot.docs
    .filter((d) => d.id !== "_placeholder_")
    .map((d) => deleteDoc(d.ref));

  await Promise.all(deletePromises);
  console.log(`✅ Deleted all docs from ${collectionName}, placeholder kept.`);
};

export const getEmigrants = async () => {
  const snapshot = await getDocs(emigrantsCollection);
  return snapshot.docs
    .filter(doc => doc.id !== "_placeholder_") 
    .map(doc => ({ id: doc.id, ...doc.data() }));
};

