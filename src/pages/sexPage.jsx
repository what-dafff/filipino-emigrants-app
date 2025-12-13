import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getEmigrants } from "../services/sex";
import { toast } from "react-toastify";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import "../style.css";

const COLORS = ["#3b82f6", "#ec4899"];
const cleanNumber = (val) => Number(String(val || "0").replace(/[, ]/g, "")) || 0;

const SexPage = () => {
  const [data, setData] = useState([]);
  const [selectedSex, setSelectedSex] = useState("All");
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();
        if (!allData || allData.length === 0) {
          toast.info("No sex data found.");
          setData([]);
          return;
        }

        const processed = allData
          .map((d) => {
            const normalized = Object.fromEntries(
              Object.entries(d).map(([key, value]) => [key.toLowerCase().trim(), value])
            );
            return {
              year: cleanNumber(normalized.year) || 0,
              male: cleanNumber(normalized.male) || 0,
              female: cleanNumber(normalized.female) || 0,
              total:
                (cleanNumber(normalized.male) || 0) +
                (cleanNumber(normalized.female) || 0),
            };
          })
          .filter((d) => d.year !== 0)
          .sort((a, b) => a.year - b.year);

        setData(processed);
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error("Failed to fetch sex data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading sex data...</p>;
  if (!data.length) return <p>No sex data available.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);

  const totalMale = data.reduce((sum, d) => sum + d.male, 0);
  const totalFemale = data.reduce((sum, d) => sum + d.female, 0);
  const pieData = [
    { name: "Male", value: totalMale },
    { name: "Female", value: totalFemale },
  ];

  const filteredData =
    selectedSex === "All"
      ? data
      : data.map((d) => ({
          year: d.year,
          [selectedSex.toLowerCase()]: d[selectedSex.toLowerCase()],
        }));

  return (
    <>
      <section className="charts-section">
        {/* Donut Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Sex Composition</h3>
            <p>Overall proportion of male and female emigrants</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={5}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) =>
                  `${name}: ${value.toLocaleString()}`
                }
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart */}
        <div className="chart-card" style={{ position: "relative" }}>
          <div className="chart-header">
            <h3>Sex Trends Over Time</h3>
            <p>
              {selectedSex === "All"
                ? "Yearly changes in male and female emigrants"
                : `Trend for ${selectedSex} emigrants over the years`}
            </p>
          </div>

          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "20px",
              zIndex: 2,
            }}
          >
            <select
              value={selectedSex}
              onChange={(e) => setSelectedSex(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                cursor: "pointer",
                background: "white",
              }}
            >
              <option value="All">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Legend />
              {(selectedSex === "All" || selectedSex === "Male") && (
                <Area
                  type="monotone"
                  dataKey="male"
                  stackId="1"
                  stroke={COLORS[0]}
                  fill={COLORS[0]}
                  fillOpacity={0.4}
                  name="Male"
                />
              )}
              {(selectedSex === "All" || selectedSex === "Female") && (
                <Area
                  type="monotone"
                  dataKey="female"
                  stackId="1"
                  stroke={COLORS[1]}
                  fill={COLORS[1]}
                  fillOpacity={0.4}
                  name="Female"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Table */}
      <section className="table-section" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">Sex Data Records</h2>
        <DynamicEmigrantsTable service="sex" onDataAdded={refreshData} />
      </section>
    </>
  );
};

export default SexPage;
