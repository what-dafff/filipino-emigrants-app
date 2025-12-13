// src/services/createOccupationCollection.mjs
import { db } from "../firebase.js";
import { collection, addDoc } from "firebase/firestore";

// ✅ Firestore collection name
const COLLECTION_NAME = "emigrants_occupation";

// ✅ Occupation fields
const occupationFields = [
  "agri_animal_forestry_fishermen",
  "production_transport_equipment_laborers",
  "armed_forces",
  "housewives",
  "retirees",
  "students",
  "minors_below_7",
  "out_of_school_youth",
  "refugees",
  "no_occupation_reported",
  "professional_technical_related",
  "managerial_executive_admin",
  "clerical_workers",
  "sales_workers",
  "service_workers"
];

// ✅ Year range (1988–2020)
const years = Array.from({ length: 40 }, (_, i) => 1981 + i);

// ✅ Function to create Firestore collection with default data
async function createOccupationCollection() {
  try {
    const collectionRef = collection(db, COLLECTION_NAME);
    console.log(`📘 Creating Firestore collection: '${COLLECTION_NAME}'\n`);

    for (const year of years) {
      // Create default record for this year
      const record = { year };

      // Initialize all occupation fields with 0
      for (const field of occupationFields) {
        record[field] = 0;
      }

      // Add to Firestore
      await addDoc(collectionRef, record);
      console.log(`✅ Added record for year ${year}`);
    }

    console.log(
      `\n🎉 Successfully created '${COLLECTION_NAME}' collection with ${years.length} records!`
    );
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error creating '${COLLECTION_NAME}' collection:`, error);
    process.exit(1);
  }
}

createOccupationCollection();

// 🧠 To run this script:
// 👉 node src/services/createOccupationCollection.mjs
