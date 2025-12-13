import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { toast } from "react-toastify";
import { getEmigrants } from "../services/majorCountry";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import { calculateTotal } from "../utils/calculateTotal";
import "../style.css";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#2f009cff",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#cc96ffff",
  "#1dddffff",
  "#ffee02ff",
  "#a70000ff",
];

const DestinationCountryPage = () => {
  const [data, setData] = useState([]);
  const [countryKeys, setCountryKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [visibleCountries, setVisibleCountries] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();

        if (!allData || allData.length === 0) {
          setData([]);
          toast.info("No data found in the Destination Country dataset.");
          return;
        }

        // Sort data by year in ascending order
        const processed = allData
          .map((d) => ({
            ...d,
            year: Number(d.year),
            total: calculateTotal(d),
          }))
          .sort((a, b) => a.year - b.year);

        const first = processed[0];
        const keys = Object.keys(first).filter(
          (k) =>
            k &&
            !["id", "year", "total", "_collection"].includes(k) &&
            /[A-Za-z]/.test(k)
        );

        setCountryKeys(keys);
        setVisibleCountries(new Set(keys)); // Initially show all countries
        setData(processed);
      } catch (e) {
        console.error("Fetch Error:", e);
        toast.error("Failed to fetch destination country data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataVersion]);

  // Country Filter Component
  const CountryFilter = () => {
    const allSelected = visibleCountries.size === countryKeys.length;

    const handleSelectAllToggle = () => {
      setVisibleCountries(allSelected ? new Set() : new Set(countryKeys));
    };

    return (
      <div style={{ marginTop: "15px" }}>
        {/* Select/Unselect All Button */}
        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={handleSelectAllToggle}
            style={{
              backgroundColor: allSelected ? "#dc2626" : "#2563eb",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            {allSelected ? "Unselect All" : "Select All"}
          </button>
          <span style={{ marginLeft: "10px", fontSize: "0.9rem", color: "#666" }}>
            {visibleCountries.size} of {countryKeys.length} countries selected
          </span>
        </div>

        {/* Checkboxes */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            background: "#f9fafb",
            padding: "10px",
            borderRadius: "8px",
            maxHeight: "120px",
            overflowY: "auto",
          }}
        >
          {countryKeys.map((key, index) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              <input
                type="checkbox"
                checked={visibleCountries.has(key)}
                onChange={() => {
                  setVisibleCountries((prev) => {
                    const updated = new Set(prev);
                    updated.has(key) ? updated.delete(key) : updated.add(key);
                    return updated;
                  });
                }}
              />
              <span
                style={{
                  color: COLORS[index % COLORS.length],
                  fontWeight: 500,
                }}
              >
                {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return <p>Loading destination country data...</p>;
  if (!data.length) return <p>No destination country data available.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);

  // --- Total emigrants per country ---
  const totalPerCountry = countryKeys.map((key) => ({
    country: key,
    formattedName: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    total: data.reduce((sum, d) => sum + (Number(d[key]) || 0), 0),
  }));

  const sortedTotal = [...totalPerCountry].sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="page-header mb-8"></div>

      {/* --- Chart Section --- */}
      <section className="charts-section grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Bar Chart: Comparison per Country */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Emigrants by Destination Country</h3>
            <p>Top destination countries (all years combined)</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={sortedTotal.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedName" angle={-20} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip formatter={(value) => [value.toLocaleString(), "Emigrants"]} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {sortedTotal.slice(0, 15).map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart: Trends Over Time */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Trends Over Time by Country</h3>
            <p>Yearly changes in emigrants per destination country</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [value.toLocaleString(), "Emigrants"]} />
              <Legend />
              {countryKeys.map(
                (key, index) =>
                  visibleCountries.has(key) && (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  )
              )}
            </LineChart>
          </ResponsiveContainer>
          <CountryFilter />
        </div>
      </section>

      {/* --- Table Section --- */}
      <section className="table-section mt-8">
        <h2 className="section-title">Destination Country Data Records</h2>
        <DynamicEmigrantsTable
          service="majorCountry"
          onDataAdded={refreshData}
        />
      </section>
    </>
  );
};

export default DestinationCountryPage;
