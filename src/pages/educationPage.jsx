import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { getEmigrants } from "../services/education";
import { toast } from "react-toastify";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import { calculateTotal } from "../utils/calculateTotal";
import "../style.css";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#a855f7", "#06b6d4", "#eab308",
];

const EducationPage = () => {
  const [data, setData] = useState([]);
  const [eduKeys, setEduKeys] = useState([]);
  const [selectedEdu, setSelectedEdu] = useState("All");
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();
        if (!allData || allData.length === 0) {
          toast.info("No educational attainment data found.");
          setData([]);
          return;
        }

        const processed = allData.map((d) => ({
          ...d,
          year: Number(d.year),
          total: calculateTotal(d),
        }));

        const first = processed[0];
        const keys = Object.keys(first).filter(
          (k) =>
            k &&
            !["id", "year", "total", "_collection"].includes(k) &&
            /school|education|elementary|high|college|graduate|vocational|post|non|not/i.test(k)
        );

        setEduKeys(keys);
        setData(processed);
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error("Failed to fetch educational attainment data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading educational data...</p>;
  if (!data.length) return <p>No educational data available.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);
  const sortedData = [...data].sort((a, b) => a.year - b.year);
  const filteredKeys =
    selectedEdu === "All" ? eduKeys : eduKeys.filter((key) => key === selectedEdu);

  const totalPerLevel = eduKeys.map((key) => ({
    educationLevel: key.replace(/([A-Z])/g, " $1"),
    total: data.reduce((sum, d) => sum + (Number(d[key]) || 0), 0),
  }));

  return (
    <>
      <section className="charts-section">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Comparison of Total Emigrants by Education Level</h3>
            <p>Shows total emigrants across all years per education level</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              layout="vertical"
              data={totalPerLevel}
              margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="educationLevel" type="category" />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Trends in Educational Attainment Over Time</h3>
            <p>
              {selectedEdu === "All"
                ? "Yearly trend of emigrants by educational level"
                : `Trend for ${selectedEdu.replace(/_/g, " ")} over the years`}
            </p>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="eduFilter" >
            </label>
            <select
              id="eduFilter"
              value={selectedEdu}
              onChange={(e) => setSelectedEdu(e.target.value)}
              style={{
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                cursor: "pointer",
                float: "right",
                marginTop: "-20px",
              }}
            >
              <option value="All">All</option>
              {eduKeys.map((key) => (
                <option key={key} value={key}>
                  {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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
              <Legend />
              {filteredKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.4}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="table-section" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">Educational Attainment Data Records</h2>
        <DynamicEmigrantsTable service="education" onDataAdded={refreshData} />
      </section>
    </>
  );
};

export default EducationPage;
