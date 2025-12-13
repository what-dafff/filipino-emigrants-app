import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getEmigrants } from "../services/civilStatus";
import { toast } from "react-toastify";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import { calculateTotal } from "../utils/calculateTotal";
import "../style.css";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#ffec45ff",
];

const CivilStatusPage = () => {
  const [data, setData] = useState([]);
  const [statusKeys, setStatusKeys] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();

        if (!allData || allData.length === 0) {
          toast.info("No civil status data found.");
          setData([]);
          return;
        }

        const normalizeKey = (key) =>
          key
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");

        const processed = allData.map((d) => {
          const normalized = {};
          Object.keys(d).forEach((key) => {
            if (!["id", "_collection"].includes(key)) {
              const cleanKey = normalizeKey(key);
              const value = Number(String(d[key]).replace(/,/g, "")) || 0;
              normalized[cleanKey] = value;
            }
          });
          return {
            ...normalized,
            year: Number(d.year),
            total: calculateTotal(d),
          };
        });

        const first = processed[0];
        const allKeys = Object.keys(first);
        const statusCandidates = allKeys.filter(
          (k) =>
            k &&
            !["id", "year", "total"].includes(k) &&
            /single|married|widow|widower|separated|divorc|not/i.test(k)
        );

        const renameMap = {
          widow: "widower",
          widowed: "widower",
          not_reported: "not_reported",
        };

        const mergedData = processed.map((row) => {
          const newRow = { ...row };
          for (const [oldKey, newKey] of Object.entries(renameMap)) {
            if (newRow[oldKey] !== undefined) {
              newRow[newKey] =
                (newRow[newKey] || 0) + Number(newRow[oldKey] || 0);
              delete newRow[oldKey];
            }
          }
          return newRow;
        });

        const consistentKeys = [...new Set(
          statusCandidates.map((k) => renameMap[k] || k)
        )];

        setStatusKeys(consistentKeys);
        setData(mergedData);
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error("Failed to fetch civil status data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading civil status data...</p>;
  if (!data.length) return <p>No civil status data available.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);

  const formatLabel = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  // Pie chart totals
  const totalPerStatus = statusKeys.map((key) => ({
    status: key,
    total: data.reduce((sum, d) => sum + (Number(d[key]) || 0), 0),
  }));

  const sortedData = [...data].sort((a, b) => a.year - b.year);

  const filteredKeys =
    selectedStatus === "All"
      ? statusKeys
      : statusKeys.filter((key) => key === selectedStatus);

  return (
    <>
      <section className="charts-section">
        {/* Pie Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Civil Status Composition</h3>
            <p>Proportion of emigrants by civil status (all years combined)</p>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={totalPerStatus}
                cx="50%"
                cy="50%"
                outerRadius={110}
                dataKey="total"
                nameKey="status"
                label={({ status }) => formatLabel(status)}
              >
                {totalPerStatus.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Legend
                formatter={(value) => formatLabel(value)}
                verticalAlign="bottom"
                height={36}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Trends Over Time</h3>
            <p>
              {selectedStatus === "All"
                ? "Yearly changes in emigrants per civil status"
                : `Trend for ${formatLabel(selectedStatus)} over the years`}
            </p>
          </div>

          <div className="filter-container" style={{ marginBottom: "1rem" }}>
            <label htmlFor="statusFilter" style={{ marginRight: "8px" }}>
            </label>
            <select
              id="statusFilter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-input"
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                cursor: "pointer",
                float: "right",
              }}
            >
              <option value="All">All</option>
              {statusKeys.map((key) => (
                <option key={key} value={key}>
                  {formatLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={sortedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend formatter={(v) => formatLabel(v)} />
              {filteredKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Data Table */}
      <section className="table-section" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">Civil Status Data Records</h2>
        <DynamicEmigrantsTable
          service="civilStatus"
          onDataAdded={refreshData}
        />
      </section>
    </>
  );
};

export default CivilStatusPage;
