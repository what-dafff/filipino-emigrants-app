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
import { getEmigrants } from "../services/age";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import { calculateTotal } from "../utils/calculateTotal";
import "../style.css";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#ffa200ff",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#a855f7",
  "#06b6d4",
  "#ffee02ff",
  "#a70000ff",
];

const AgeGroupPage = ({}) => {
  const [data, setData] = useState([]);
  const [ageKeys, setAgeKeys] = useState([]);
  const [selectedAges, setSelectedAges] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();

        if (!allData || allData.length === 0) {
          setData([]);
          toast.info("No data found in the Age dataset.");
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
            /\d/.test(k)
        );

        setAgeKeys(keys);
        setSelectedAges(keys); 
        setData(processed);
      } catch (e) {
        console.error("Fetch Error:", e);
        toast.error("Failed to fetch age group data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading age group data...</p>;
  if (!data.length) return <p>No age group data available.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);

  // --- Total emigrants per age group ---
  const totalPerAgeGroup = ageKeys
    .map((key) => ({
      ageGroup: key,
      total: data.reduce((sum, d) => sum + (Number(d[key]) || 0), 0),
    }))
    .sort((a, b) => {
      const getNum = (str) => parseInt(str.match(/\d+/)?.[0] || 0, 10);
      return getNum(a.ageGroup) - getNum(b.ageGroup);
    });

  // --- Handle filter change ---
  const toggleAgeSelection = (age) => {
    setSelectedAges((prev) =>
      prev.includes(age)
        ? prev.filter((a) => a !== age)
        : [...prev, age]
    );
  };

  const selectAll = () => setSelectedAges(ageKeys);
  const deselectAll = () => setSelectedAges([]);

  return (
    <>
      <div className="page-header mb-8"></div>

      {/* --- Chart Section --- */}
      <section className="charts-section grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Comparison Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Comparison by Age Group</h3>
            <p>Total emigrants per age bracket (all years combined)</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={totalPerAgeGroup}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ageGroup" angle={-20} textAnchor="end" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {totalPerAgeGroup.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trends Over Time */}
        <div className="chart-card">
          <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3>Trends Over Time by Age Group</h3>
              <p>Yearly changes in emigrants per age group</p>
            </div>
            {/* Filter Dropdown */}
            <div>
              <button onClick={selectAll} className="btn-secondary" style={{ marginBottom: "6px" }}>Select All</button>
              <button onClick={deselectAll} className="btn-secondary">Clear</button>
            </div>
          </div>

          {/* Checkbox Filter */}
          <div className="filter-container" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {ageKeys.map((age) => (
              <label key={age} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  type="checkbox"
                  checked={selectedAges.includes(age)}
                  onChange={() => toggleAgeSelection(age)}
                />
                <span>{age}</span>
              </label>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={[...data].sort((a, b) => a.year - b.year)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedAges.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* --- Table Section --- */}
      <section className="table-section" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">Age Group Data Records</h2>
        {data.length > 0 && (
          <DynamicEmigrantsTable
            service="age"
            onDataAdded={refreshData}
          />
        )}
      </section>
    </>
  );
};

export default AgeGroupPage;
