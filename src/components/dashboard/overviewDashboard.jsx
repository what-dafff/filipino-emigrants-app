import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup,
} from "react-simple-maps";
import { toast } from "react-toastify";
import { getEmigrants as getSex } from "../../services/sex";
import { getEmigrants as getCivilStatus } from "../../services/civilStatus";
import { getEmigrants as getAge } from "../../services/age";
import { getEmigrants as getOccupation } from "../../services/occupation";
import { getEmigrants as getEducation } from "../../services/education";
import { getEmigrants as getMajorCountry } from "../../services/majorCountry";
import { Users, Mars, Venus } from "lucide-react";
import "../../style.css";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#a855f7", "#06b6d4",
];

const coordinatesMap = {
  australia: [133.7751, -25.2744],
  canada: [-106.3468, 56.1304],
  germany: [10.4515, 51.1657],
  italy: [12.5674, 41.8719],
  japan: [138.2529, 36.2048],
  new_zealand: [174.8859, -40.9006],
  south_korea: [127.7669, 35.9078],
  spain: [-3.7038, 40.4168],
  united_kingdom: [-3.436, 55.3781],
  usa: [-95.7129, 37.0902],
  others: [0, 20],
};

const OverviewDashboard = ({ dataVersion }) => {
  const [sexData, setSexData] = useState([]);
  const [civilData, setCivilData] = useState([]);
  const [ageData, setAgeData] = useState([]);
  const [occupationData, setOccupationData] = useState([]);
  const [educationData, setEducationData] = useState([]);
  const [countryData, setCountryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapPosition, setMapPosition] = useState({ coordinates: [0, 0], zoom: 1 });
  const [hoveredCountry, setHoveredCountry] = useState(null);

  const cleanNum = (v) => Number(String(v || "0").replace(/[, ]/g, "")) || 0;

  const handleMoveEnd = (position) => setMapPosition(position);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [sexRaw, civilRaw, ageRaw, occRaw, eduRaw, countryRaw] =
          await Promise.all([
            getSex(),
            getCivilStatus(),
            getAge(),
            getOccupation(),
            getEducation(),
            getMajorCountry(),
          ]);

        // --- Sex ---
        setSexData(
          sexRaw.map((d) => ({
            year: +d.year,
            male: cleanNum(d.male),
            female: cleanNum(d.female),
          }))
        );

        // --- Civil Status ---
        setCivilData(
          civilRaw.map((d) => ({
            year: +d.year,
            single: cleanNum(d.single),
            married: cleanNum(d.married),
            separated: cleanNum(d.separated),
            divorced: cleanNum(d.divorced),
          }))
        );

        // --- Age ---
        setAgeData([...ageRaw].map((d) => ({ ...d, year: +d.year })).sort((a, b) => a.year - b.year));

        // --- Occupation ---
        const occKeys = Object.keys(occRaw[0] || {}).filter(
          (k) => !["id", "year", "_collection"].includes(k) && !/^_?\d+$/.test(k)
        );
        setOccupationData(
          occKeys.map((key) => ({
            occupation: key.replace(/_/g, " "),
            total: occRaw.reduce((s, d) => s + cleanNum(d[key]), 0),
          }))
        );

        // --- Education ---
        const eduKeys = Object.keys(eduRaw[0] || {}).filter((k) => !["id", "year", "_collection"].includes(k));
        setEducationData(
          eduKeys.map((key) => ({
            level: key.replace(/_/g, " "),
            total: eduRaw.reduce((s, d) => s + cleanNum(d[key]), 0),
          }))
        );

        // --- Major Country ---
        const validDocs = (countryRaw || []).filter(d => d && typeof d === "object" && Object.keys(d).length > 0);
        if (!validDocs.length) {
          setCountryData([]);
        } else {
          const expectedCountries = Object.keys(coordinatesMap);
          const totals = expectedCountries.map(key => ({
            country: key,
            total: validDocs.reduce((sum, d) => sum + cleanNum(d[key]), 0),
          }));
          setCountryData(totals.filter(t => t.total > 0).sort((a, b) => b.total - a.total));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch overview data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [dataVersion]);

  if (loading) return <p>Loading dashboard data...</p>;

  const totalMale = sexData.reduce((s, d) => s + d.male, 0);
  const totalFemale = sexData.reduce((s, d) => s + d.female, 0);
  const totalEmigrants = totalMale + totalFemale;

  return (
    <>
      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div>
              <p>Total Emigrants</p>
              <h3>{totalEmigrants.toLocaleString()}</h3>
            </div>
            <div className="stat-icon blue"><Users /></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <div>
              <p>Male</p>
              <h3>{totalMale.toLocaleString()}</h3>
            </div>
            <div className="stat-icon indigo"><Mars /></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-content">
            <div>
              <p>Female</p>
              <h3>{totalFemale.toLocaleString()}</h3>
            </div>
            <div className="stat-icon pink"><Venus /></div>
          </div>
        </div>
      </div>

      <section className="charts-section">
        {/* Comparison: Occupation */}
        <div className="chart-card">
          <h3>Comparison by Occupation</h3>
          <h5>All years combined</h5>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={occupationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="occupation" angle={-25} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sex Composition */}
        <div className="chart-card">
          <h3>Sex Composition</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={[{ name: "Male", value: totalMale }, { name: "Female", value: totalFemale }]}
                cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value">
                <Cell fill="#3b82f6" />
                <Cell fill="#ec4899" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Age Trends */}
        <div className="chart-card chart-card-wide">
          <h3>Trends by Age Group</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={ageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              {Object.keys(ageData[0] || {}).filter(k => !["id","year","_collection"].includes(k))
                .map((key,i) => <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Education */}
        <div className="chart-card">
          <h3>Education Level Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={educationData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="level" type="category" />
              <Tooltip />
              <Bar dataKey="total" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter */}
        <div className="chart-card">
          <h3>Relationship: Male vs Female Counts</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="male" name="Male" label={{ value: "Number of Males", position: "bottom" }} />
              <YAxis dataKey="female" name="Female" label={{ value: "Number of Females", angle: -90, position: "left" }} />
              <ZAxis dataKey="year" range={[60, 400]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={sexData} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Bubble Map */}
        <div className="chart-card chart-card-wide">
          <h3>Interactive Bubble Map: Emigrant Distribution by Major Country</h3>
          <p>Bubble size shows total emigrants • Scroll to zoom • Drag to pan • Hover for values</p>
          <div style={{ width: "100%", height: "550px", position: "relative" }}>
            <ComposableMap projectionConfig={{ scale: 140 }}>
              <ZoomableGroup zoom={mapPosition.zoom} center={mapPosition.coordinates} onMoveEnd={handleMoveEnd}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) => geographies.map(geo => (
                    <Geography key={geo.rsmKey} geography={geo} fill="#EAEAEC" stroke="#D6D6DA" />
                  ))}
                </Geographies>

                {countryData.map((c, index) => {
                  const coords = coordinatesMap[c.country];
                  if (!coords || c.total <= 0) return null;

                  const maxTotal = Math.max(...countryData.map(d => d.total), 1);
                  const radius = 5 + Math.sqrt((c.total / maxTotal) * 50);
                  const color = COLORS[index % COLORS.length];

                  return (
                    <Marker key={c.country} coordinates={coords}>
                      <circle
                        r={radius}
                        fill={color}
                        fillOpacity={0.7}
                        stroke="#333"
                        strokeWidth={1}
                        onMouseEnter={() => setHoveredCountry({ country: c.country, total: c.total, color })}
                        onMouseLeave={() => setHoveredCountry(null)}
                        style={{ cursor: "pointer" }}
                      />
                      {/* Label for each dot */}
                      <text
                        textAnchor="middle"
                        y={-radius - 5}
                        style={{ fontSize: "12px", fontWeight: 500, fill: "#111" }}
                      >
                        {c.country.replace("_", " ")}
                      </text>
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>

            {/* Bubble Tooltip */}
            {hoveredCountry && (
              <div style={{
                position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.8)", color: "white", padding: "8px 12px", borderRadius: 6,
                fontSize: 14, fontWeight: 500, pointerEvents: "none", zIndex: 1000
              }}>
                <div><strong>{hoveredCountry.country.replace("_", " ")}</strong></div>
                <div>{hoveredCountry.total.toLocaleString()} emigrants</div>
              </div>
            )}

            {/* Reset View */}
            <button
              onClick={() => setMapPosition({ coordinates: [0, 0], zoom: 1 })}
              style={{
                position: "absolute", top: 10, left: 10, background: "#2563eb", color: "white", border: "none",
                padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500
              }}
            >
              Reset View
            </button>
          </div>
        </div>

      </section>
    </>
  );
};

export default OverviewDashboard;
