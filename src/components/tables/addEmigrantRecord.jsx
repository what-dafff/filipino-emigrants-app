import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "react-toastify";
import "../../style.css";

const AddEmigrantRecord = ({ serviceFns, onClose, onAdded, service }) => {
  const [form, setForm] = useState({ year: "" });
  const [loading, setLoading] = useState(false);

  const datasetFields = {
    age: [
      "14 - Below", "15 - 19", "20 - 24", "25 - 29", "30 - 34",
      "35 - 39", "40 - 44", "45 - 49", "50 - 54", "55 - 59",
      "60 - 64", "65 - 69", "70 - Above", "notReported",
    ],
    sex: ["male", "female"],
    education: [
      "notOfSchoolingAge", "noFormalEducation", "elementaryLevel",
      "elementaryGraduate", "highSchoolLevel", "highSchoolGraduate",
      "vocationalLevel", "vocationalGraduate", "collegeLevel",
      "collegeGraduate", "postGraduateLevel", "postGraduate",
      "nonFormalEducation", "notReported",
    ],
    occupation: [
      "agri_animal_forestry_fishermen", "production_transport_equipment_laborers",
      "armed_forces", "housewives", "retirees", "students", "minors_below_7",
      "out_of_school_youth", "refugees", "no_occupation_reported",
      "professional_technical_related", "managerial_executive_admin",
      "clerical_workers", "sales_workers", "service_workers",
    ],
    civilStatus: [
      "single", "married", "widower", "separated", "divorced", "notReported",
    ],
    majorCountry: [
      "australia", "canada", "germany", "italy", "japan", "new_zealand",
      "others", "south_korea", "spain", "united_kingdom", "usa",
    ],
    origin: [
      "Region I - Ilocos Region", "Region II - Cagayan Valley",
      "Region III - Central Luzon", "Region IV A - CALABARZON",
      "Region IV B - MIMAROPA", "Region V - Bicol Region",
      "Region VI - Western Visayas", "Region VII - Central Visayas",
      "Region VIII - Eastern Visayas", "Region IX - Zamboanga Peninsula",
      "Region X - Northern Mindanao", "Region XI - Davao Region",
      "Region XII - SOCCSKSARGEN", "Region XIII - Caraga",
      "Autonomous Region in Muslim Mindanao (ARMM)",
      "Cordillera Administrative Region (CAR)",
      "National Capital Region (NCR)", "Not Reported",
    ],
    allCountries: Array.from({ length: 40 }, (_, i) => String(1981 + i)),
  };

  const datasetKey = service
    .replace("Service", "")
    .replace("emigrants_", "");
  const currentFields = datasetFields[datasetKey] || [];

  useEffect(() => {
    const initialValues = {};
    currentFields.forEach((field) => {
      initialValues[field] = "0";
    });
    setForm((prev) => ({ ...initialValues, ...prev }));
  }, [service]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async () => {
    if (
      (service === "allCountries" && !form.COUNTRY) ||
      (service !== "allCountries" && !form.year)
    ) {
      toast.error(
        `Please enter a valid ${
          service === "allCountries" ? "country" : "year"
        }.`
      );
      return;
    }

    const data = { ...form };

    if (service === "allCountries" && data.COUNTRY) {
      data.COUNTRY = data.COUNTRY.trim().toUpperCase();
    }

    currentFields.forEach((field) => {
      if (data[field] === undefined || data[field] === "") data[field] = 0;
    });

    try {
      setLoading(true);
      await serviceFns.addEmigrant(data);
      toast.success("All records added successfully!");
      if (onAdded) await onAdded(); 
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add record. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "650px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <h2>
            Add {service.charAt(0).toUpperCase() + service.slice(1)} Records
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {service === "allCountries" ? (
            <div className="form-group">
              <label>Country *</label>
              <input
                type="text"
                name="COUNTRY"
                value={form.COUNTRY || ""}
                onChange={handleChange}
                className="form-input"
                disabled={loading}
                placeholder="e.g., Japan"
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Year *</label>
              <input
                type="text"
                name="year"
                value={form.year || ""}
                onChange={handleChange}
                className="form-input"
                disabled={loading}
                placeholder="e.g., 2024"
                required
              />
            </div>
          )}

          {currentFields.length > 0 ? (
            currentFields.map((field) => (
              <div className="form-group" key={field}>
                <label>
                  {field.replace(/_/g, " ").replace(/\b\w/g, (c) =>
                    c.toUpperCase()
                  )}
                </label>
                <input
                  type="text"
                  name={field}
                  value={form[field] ?? "0"} 
                  onChange={handleChange}
                  className="form-input"
                  disabled={loading}
                  placeholder="0"
                />
              </div>
            ))
          ) : (
            <p>No dataset fields defined for this category.</p>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleAdd} className="btn-primary" disabled={loading}>
            <Plus size={18} />
            Add All Records
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEmigrantRecord;
