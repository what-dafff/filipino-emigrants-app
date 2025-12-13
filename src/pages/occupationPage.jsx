import React, { useEffect, useState } from "react";
import {
  Treemap,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getEmigrants } from "../services/occupation";
import { toast } from "react-toastify";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import "../style.css";

const RAW_COLORS = {
  professional_technical_related: "#6366f1",
  managerial_executive: "#10b981",
  clerical_workers: "#f59e0b",
  sales_workers: "#f88585ff",
  service_workers: "#8b5cf6",
  agricultural: "#14b8a6",
  production_transport_equipment_laborers: "#f97316",
  armed_forces: "#84cc16",
  housewives: "#cc9ff7ff",
  retirees: "#50e5ffff",
  students: "#dc2626",
  minors_below_7: "#facc15",
  out_of_school_youth: "#3b82f6",
  refugees: "#ec4899",
  no_occupation_reported: "#64748b",
};

const normalize = (str) =>
  str.toLowerCase().replace(/[\s_-]+/g, "").replace(/s$/, "");

const OCCUPATION_COLORS = Object.fromEntries(
  Object.entries(RAW_COLORS).map(([k, v]) => [normalize(k), v])
);

const getFixedColor = (name) => {
  const normalized = normalize(name);
  return OCCUPATION_COLORS[normalized] || "#9ca3af"; 
};

const OccupationPage = () => {
  const [data, setData] = useState([]);
  const [occupationKeys, setOccupationKeys] = useState([]);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();
        if (!allData || allData.length === 0) {
          toast.info("No occupation data found.");
          setData([]);
          return;
        }

        const processed = allData.map((d) => ({
          ...d,
          year: Number(d.year),
        }));

        const first = processed[0];
        const keys = Object.keys(first).filter(
          (k) =>
            k &&
            !["id", "year", "_collection", "total"].includes(k) &&
            !/^\d+$/.test(k) &&
            /professional|managerial|clerical|sales|service|agricultural|production|armed|housewives|retirees|students|minors|out_of_school|refugees|no_occupation/i.test(
              k
            )
        );

        setOccupationKeys(keys);
        setVisibleKeys(new Set(keys));
        setData(processed);
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error("Failed to fetch occupation data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading occupation data...</p>;
  if (!data.length) return <p>No occupation data available.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);
  const formatLabel = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const totalPerOccupation = occupationKeys.map((key) => ({
    name: key.replace(/_/g, " "),
    size: data.reduce((sum, d) => sum + (Number(d[key]) || 0), 0),
  }));

  const sortedData = [...data].sort((a, b) => a.year - b.year);

  const CheckboxLegend = () => {
    const allSelected = visibleKeys.size === occupationKeys.length;

    const handleSelectAllToggle = () => {
      setVisibleKeys(
        allSelected ? new Set() : new Set(occupationKeys)
      );
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
          }}
        >
          {occupationKeys.map((key) => (
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
                checked={visibleKeys.has(key)}
                onChange={() => {
                  setVisibleKeys((prev) => {
                    const updated = new Set(prev);
                    updated.has(key) ? updated.delete(key) : updated.add(key);
                    return updated;
                  });
                }}
              />
              <span
                style={{
                  color: getFixedColor(key),
                  fontWeight: 500,
                }}
              >
                {formatLabel(key)}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="charts-section">
        {/* TREEMAP (Composition Overview) */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Overall Occupation Composition</h3>
            <p>
              Proportion of emigrants by occupation type (all years combined)
            </p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <Treemap
              data={totalPerOccupation}
              dataKey="size"
              nameKey="name"
              stroke="#fff"
              fill="#6366f1"
              content={({ x, y, width, height, name }) => (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                      fill: getFixedColor(name.toLowerCase().replace(/ /g, "_")),
                      stroke: "#fff",
                      strokeWidth: 1,
                    }}
                  />
                  {width > 80 && height > 20 && (
                    <text
                      x={x + width / 2}
                      y={y + height / 2}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {name}
                    </text>
                  )}
                </g>
              )}
            >
              <ReTooltip
                content={({ payload }) =>
                  payload && payload.length ? (
                    <div
                      style={{
                        background: "white",
                        padding: "8px",
                        borderRadius: "5px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <strong>{payload[0].payload.name}</strong>
                      <br />
                      Total: {payload[0].payload.size.toLocaleString()}
                    </div>
                  ) : null
                }
              />
            </Treemap>
          </ResponsiveContainer>
        </div>

        {/* LINE CHART */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Trends Over Time by Occupation</h3>
            <p>Select or deselect occupations using checkboxes below</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={sortedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              {occupationKeys.map(
                (key) =>
                  visibleKeys.has(key) && (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={getFixedColor(key)}
                      strokeWidth={2}
                      dot={false}
                    />
                  )
              )}
            </LineChart>
          </ResponsiveContainer>
          <CheckboxLegend />
        </div>
      </section>

      {/* TABLE SECTION */}
      <section className="table-section" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">Occupation Data Records</h2>
        {data.length > 0 && (
          <DynamicEmigrantsTable
            service="occupation"
            onDataAdded={refreshData}
          />
        )}
      </section>
    </>
  );
};

export default OccupationPage;
