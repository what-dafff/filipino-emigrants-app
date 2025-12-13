import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "../../tableStyle.css";
import AddEmigrantRecord from "./addEmigrantRecord";
import { exportTableToCSV } from "../../utils/exportCsv";

const DynamicEmigrantsTable = ({ service = "emigrantsService", onDataAdded }) => {
  const [emigrantGroups, setEmigrantGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceFns, setServiceFns] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [editData, setEditData] = useState({});
  const [selectedIds, setSelectedIds] = useState([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const datasetName = service.replace("emigrants_", "").replace("Service", "");

  useEffect(() => {
    const loadService = async () => {
      try {
        const module = await import(`../../services/${service}.js`);
        setServiceFns({
          addEmigrant: module.addEmigrant,
          getEmigrants: module.getEmigrants,
          updateEmigrant: module.updateEmigrant,
          deleteEmigrant: module.deleteEmigrant,
          deleteAllEmigrants: module.deleteAllEmigrants,
        });
      } catch (error) {
        console.error("Error loading service module:", error);
        toast.error("Failed to load service module.");
      }
    };
    loadService();
  }, [service]);

const fetchData = async () => {
  if (!serviceFns) return;
  try {
    setLoading(true);
    const data = await serviceFns.getEmigrants();

    const groups = {};

    data.forEach((item) => {
      const validKeys = Object.keys(item).filter((key) => {
        if (!key) return false;
        if (["id", "_collection", "__typename"].includes(key)) return false;
        if (datasetName !== "allCountries" && /^_?\d+$/.test(key)) return false;
        if (typeof item[key] === "object") return false;
        return true;
      });

      const signature = validKeys
        .map((k) => {
          if (datasetName === "age") 
            return k.toLowerCase().trim();
          return k.toLowerCase().replace(/\s+/g, "").replace(/-/g, "").trim();
        })
        .sort()
        .join("|");

      if (!groups[signature]) {
        groups[signature] = {
          headers: validKeys,
          records: [],
        };
      }

      groups[signature].records.push(item);
    });

    Object.values(groups).forEach((group) => {
      group.records.sort((a, b) => (a.year || 0) - (b.year || 0));
    });

    setEmigrantGroups(Object.values(groups));
    setSelectedIds([]);
  } catch (error) {
    console.error("Error fetching emigrants:", error);
    toast.error("Failed to load data. Please refresh.");
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    if (serviceFns) fetchData();
  }, [serviceFns]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = (records) => {
    const ids = records.map((r) => r.id);
    setSelectedIds((prev) =>
      ids.every((id) => prev.includes(id))
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.info("No records selected.");
      return;
    }

    if (!window.confirm(`Delete ${selectedIds.length} selected record(s)?`))
      return;

    try {
      setLoading(true);
      for (const id of selectedIds) {
        await serviceFns.deleteEmigrant(id);
      }
      toast.success("Selected records deleted!");
      await fetchData();
    } catch (error) {
      console.error("Error deleting selected records:", error);
      toast.error("Failed to delete selected records.");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (record) => {
    setEditRecord(record);
    setEditData(record);
  };

  const closeEditModal = () => {
    setEditRecord(null);
    setEditData({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData({ ...editData, [name]: value });
  };

  const handleEditSubmit = async () => {
    try {
      await serviceFns.updateEmigrant(editRecord.id, editData);
      toast.success("Record updated successfully!");
      closeEditModal();
      await fetchData();
    } catch (error) {
      console.error("Error updating record:", error);
      toast.error("Failed to update record.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await serviceFns.deleteEmigrant(id);
      toast.success("Record deleted successfully!");
      await fetchData();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Delete failed. Try again.");
    }
  };

  const formatHeader = (header) => {
    if (!header) return "";
    const cleaned = header
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return cleaned;
  };

  const orderKeys = (keys) => {
    const lowerKeys = keys.map((k) => k.toLowerCase());
    const hasCountry = lowerKeys.includes("country") || lowerKeys.includes("country_name") || lowerKeys.includes("COUNTRY");
    const hasYear = lowerKeys.includes("year");

    const sorted = [...keys].sort((a, b) => a.localeCompare(b));

    if (hasCountry) {
      const countryKey = keys.find((k) => k.toLowerCase() === "country" || k === "COUNTRY");
      return [countryKey, ...sorted.filter((k) => k !== countryKey)];
    }

    if (hasYear) {
      const yearKey = keys.find((k) => k.toLowerCase() === "year");
      return [yearKey, ...sorted.filter((k) => k !== yearKey)];
    }

    return sorted;
  };


    // Filter data by search
  const filteredGroups = emigrantGroups.map((group) => ({
    ...group,
    records: group.records.filter((record) =>
      Object.values(record).some(
        (value) =>
          value &&
          value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    ),
  }));

  if (loading)
    return <p className="table-loading">Loading emigrant datasets...</p>;
  if (emigrantGroups.length === 0)
    return <p className="table-empty">No emigrant data found.</p>;

  return (
    <div className="dynamic-table-container">
      <h2 className="table-section-title">Emigrants Table ({service})</h2>

      {/* Toolbar Section */}
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "100px",
        }}
      >
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleDeleteSelected}
          className="btn-secondary"
          disabled={selectedIds.length === 0 || loading}
          title="Delete Selected Records"
        >
          🗑️ Delete Selected ({selectedIds.length})
        </button>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search a year or country..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
          style={{ flex: 1, maxWidth: "300px", marginLeft: "200px" }}
        />

        {/* Add Emigrant Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          Add Record
        </button>

        {/* Export Button */}
        <button
          onClick={() => {
            const exportData = filteredGroups.flatMap((group) => group.records);
            if (exportData.length === 0) {
              toast.warn("No records available to export.");
              return;
            }
            const filename = `${service.replace("Service", "")}_data.csv`;
            exportTableToCSV(exportData, filename);
          }}
          className="btn-download"
        >
          Export CSV
        </button>
        </div>
      </div>

      {filteredGroups.map((group, index) => {
        const orderedHeaders = orderKeys(group.headers);
        
      const visibleHeaders = orderedHeaders.filter(header => header.trim() !== "");

        if (group.records.length === 0) return null;

        return (
        <div key={index} className="table-card">
          <div className="table-scroll">
            <table className="dynamic-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      onChange={() => selectAll(group.records)}
                      checked={group.records.every((r) =>
                        selectedIds.includes(r.id)
                      )}
                    />
                  </th>

                  {visibleHeaders.map((header) => (
                    <th key={header}>{formatHeader(header)}</th>
                  ))}

                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.records.map((record, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => toggleSelect(record.id)}
                      />
                    </td>

                    {visibleHeaders.map((header) => (
                      <td key={header}>{record[header] ??
                        record[header.replace(/\s+/g, "").replace(/-/g, "")] ?? ""}
                      </td>
                    ))}

                    <td className="table-actions">
                      <button
                        className="btn-edit"
                        onClick={() => openEditModal(record)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(record.id)}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    })}
            
      {/* Add Modal */}
        {showAddModal && (
          <AddEmigrantRecord
            serviceFns={serviceFns}
            service={service}
            onClose={() => setShowAddModal(false)}
            onAdded={async () => {
            await fetchData(); 
            }}
          />
        )}

      {/* Edit Modal */}
        {editRecord && (
          <div className="modal-overlay" onClick={closeEditModal}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "600px" }}
            >
              <div className="modal-header">
                <h2>Edit Record</h2>
                <button onClick={closeEditModal} className="modal-close">
                  ✖
                </button>
              </div>

              <div className="modal-body">
                {(() => {
                  const keys = Object.keys(editData).filter(
                    (k) => k !== "id" && k !== "_collection"
                  );

                  const countryKeys = keys.filter(
                    (k) => k.toLowerCase() === "country" || k.toLowerCase() === "country_name"
                  );
                  const yearKeys = keys.filter((k) => k.toLowerCase() === "year");

                  const otherKeys = keys
                    .filter(
                      (k) =>
                        !countryKeys.includes(k) &&
                        !yearKeys.includes(k)
                    )
                    .sort((a, b) => {
                      const numA = parseInt(a.match(/\d+/)?.[0]);
                      const numB = parseInt(b.match(/\d+/)?.[0]);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return a.localeCompare(b);
                    });

                  const orderedKeys = [...countryKeys, ...yearKeys, ...otherKeys];

                  return orderedKeys.map((key) => (
                    <div className="form-group" key={key}>
                      <label>{formatHeader(key)}</label>
                      <input
                        type="text"
                        name={key}
                        value={editData[key] ?? ""}
                        onChange={handleEditChange}
                        className="form-input"
                      />
                    </div>
                  ));
                })()}
              </div>

              <div className="modal-footer">
                <button onClick={closeEditModal} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleEditSubmit} className="btn-primary">
                  💾 Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default DynamicEmigrantsTable;
