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
  LineChart,
  Line,
} from "recharts";
import { toast } from "react-toastify";
import { getEmigrants } from "../services/allCountries";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";
import "../style.css";

const AllCountriesPage = () => {
  const [data, setData] = useState([]);
  const [nonZeroCountries, setNonZeroCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedCountries, setSelectedCountries] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allData = await getEmigrants();

        if (!allData || allData.length === 0) {
          toast.info("No data found in the All Countries dataset.");
          setData([]);
          return;
        }

        const processed = allData.map((doc) => {
          const rawCountry = doc?.COUNTRY || doc?.country || "UNKNOWN";
          const country = rawCountry ? rawCountry.trim().toUpperCase() : "UNKNOWN";

          const yearData = Object.entries(doc)
            .filter(([key]) => /^\d+$/.test(key))
            .map(([year, value]) => ({
              year: Number(year),
              total: Number(value) || 0,
            }));

          const total = yearData.reduce((sum, y) => sum + y.total, 0);
          return { country, total, yearData };
        });

        const merged = Object.values(
          processed.reduce((acc, curr) => {
            if (!acc[curr.country]) acc[curr.country] = { ...curr };
            else acc[curr.country].total += curr.total;
            return acc;
          }, {})
        );

        const nonZero = merged.filter((d) => d.total > 0);
        setData(merged);
        setNonZeroCountries(nonZero);

        // Initialize with all top 5 countries selected
        const topFiveCountries = nonZero
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
          .map(country => country.country);
        
        setSelectedCountries(new Set(topFiveCountries));

        if (nonZero.length === 0)
          toast.warn("No countries with valid emigrant totals found.");
      } catch (e) {
        console.error("Fetch Error:", e);
        toast.error("Failed to fetch all countries data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading all countries data...</p>;
  if (!data.length) return <p>No all countries data available.</p>;
  if (nonZeroCountries.length === 0)
    return <p>No valid emigrant data available for visualization.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);

  // --- Prepare data for charts ---
  const sortedCountries = [...nonZeroCountries].sort(
    (a, b) => b.total - a.total
  );
  const topCountries = sortedCountries.slice(0, 20);
  const topFive = sortedCountries.slice(0, 5);

  // Get selected countries data for line chart
  const selectedCountriesData = topFive.filter(country => 
    selectedCountries.has(country.country)
  );

  // Build time series data for selected countries
  const allYears = Array.from(
    new Set(
      selectedCountriesData.flatMap((country) => country.yearData.map((y) => y.year))
    )
  ).sort((a, b) => a - b);

  const lineData = allYears.map((year) => {
    const row = { year };
    selectedCountriesData.forEach((country) => {
      const match = country.yearData.find((y) => y.year === year);
      row[country.country] = match ? match.total : 0;
    });
    return row;
  });

  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  // Country Filter Component for Top 5 Countries
  const CountryFilter = () => {
    const allSelected = selectedCountries.size === topFive.length;

    const handleSelectAllToggle = () => {
      if (allSelected) {
        setSelectedCountries(new Set());
      } else {
        const allCountryNames = topFive.map(country => country.country);
        setSelectedCountries(new Set(allCountryNames));
      }
    };

    const handleCountryToggle = (countryName) => {
      setSelectedCountries(prev => {
        const updated = new Set(prev);
        if (updated.has(countryName)) {
          updated.delete(countryName);
        } else {
          updated.add(countryName);
        }
        return updated;
      });
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
            {selectedCountries.size} of {topFive.length} countries selected
          </span>
        </div>

        {/* Country Checkboxes - Only Top 5 */}
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
          {topFive.map((country, index) => (
            <label
              key={country.country}
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
                checked={selectedCountries.has(country.country)}
                onChange={() => handleCountryToggle(country.country)}
              />
              <span
                style={{
                  color: COLORS[index % COLORS.length],
                  fontWeight: 500,
                }}
              >
                {country.country}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-header mb-8"></div>

      {/* --- Visualization Section --- */}
      <section className="charts-section grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Horizontal Bar Chart */}
        <div className="chart-card" style={{ height: "450px" }}>
          <div className="chart-header">
            <h3>Top 20 Destination Countries</h3>
            <p>Ranked by total emigrants (all years combined)</p>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart
              data={topCountries.reverse()}
              layout="vertical"
              margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="country"
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Legend />
              <Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart: Trends Over Time */}
        <div className="chart-card" style={{ height: "450px" }}>
          <div className="chart-header">
            <h3>Trends Over Time (Top 5 Countries)</h3>
            <p>Yearly emigrant trends for selected countries</p>
          </div>
          <ResponsiveContainer width="100%" height="50%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Legend />
              {selectedCountriesData.map((country, i) => (
                <Line
                  key={country.country}
                  type="monotone"
                  dataKey={country.country}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          
          {/* Country Filter */}
          <CountryFilter />
        </div>
      </section>

      {/* --- Table Section --- */}
      <section className="table-section mt-8">
        <h2 className="section-title">All Countries Data Records</h2>
        <DynamicEmigrantsTable
          service="allCountries"
          onDataAdded={refreshData}
        />
      </section>
    </>
  );
};

export default AllCountriesPage;