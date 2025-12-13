import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";
import { toast } from "react-toastify";
import { getEmigrants as getOrigin } from "../services/origin";
import DynamicEmigrantsTable from "../components/tables/dynamicEmigrantsTable";

const COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c", 
  "#d62728",
  "#9467bd", 
  "#8c564b", 
  "#e377c2", 
  "#7f7f7f", 
  "#bcbd22", 
  "#17becf", 
  "#ffbb78", 
  "#98df8a", 
  "#c5b0d5", 
  "#ff9896", 
  "#aec7e8", 
];

const allowedRegions = [
  "Autonomous Region In Muslim Mindanao (ARMM)",
  "Cordillera Administrative Region (CAR)",
  "National Capital Region (NCR)",
  "Not Reported",
  "Region I - Ilocos Region",
  "Region II - Cagayan Valley",
  "Region III - Central Luzon",
  "Region IV A - CALABARZON",
  "Region IV B - MIMAROPA",
  "Region IX - Zamboanga Peninsula",
  "Region V - Bicol Region",
  "Region VI - Western Visayas",
  "Region VII - Central Visayas",
  "Region VIII - Eastern Visayas",
  "Region X - Northern Mindanao",
  "Region XI - Davao Region",
  "Region XII - SOCCSKSARGEN",
  "Region XIII - Caraga"
];

const getColorForRegion = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

const OriginPage = ({}) => {
  const [data, setData] = useState([]);
  const [regionData, setRegionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [yearRange, setYearRange] = useState({ start: 1988, end: 2020 });
  const [availableRegionKeys, setAvailableRegionKeys] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const allData = await getOrigin();
      if (!allData || allData.length === 0) {
        toast.info("No data found for Region of Origin dataset.");
        setData([]);
        return;
      }

      // Sort data by year
      const sortedData = [...allData].sort((a, b) => a.year - b.year);
      setData(sortedData);

      const first = sortedData[0];
      
      // Get all region keys that exist in the data
      const regionKeys = Object.keys(first).filter(
        (k) =>
          k &&
          !["id", "year", "total", "_collection"].includes(k)
      );

      console.log("Available region keys in data:", regionKeys);

      // Find which allowed regions actually exist in the data
      const existingRegions = allowedRegions.filter(region => 
        regionKeys.some(key => 
          key.toLowerCase().includes(region.toLowerCase()) ||
          key === region
        )
      );

      console.log("Existing regions found:", existingRegions);
      setAvailableRegionKeys(existingRegions);

      const totals = existingRegions.map((region) => {
        // Find the actual key in the data that matches this region
        const actualKey = regionKeys.find(key => 
          key.toLowerCase().includes(region.toLowerCase()) || 
          key === region
        );
        
        return {
          name: region,
          total: sortedData.reduce(
            (sum, row) => sum + (Number(row[actualKey]) || 0),
            0
          ),
          actualKey: actualKey // Store the actual key for data lookup
        };
      });

      totals.sort((a, b) => b.total - a.total);
      setRegionData(totals);

    } catch (error) {
      console.error("Error fetching origin data:", error);
      toast.error("Failed to fetch region of origin dataset.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataVersion]);

  if (loading) return <p>Loading Region of Origin data...</p>;
  if (!regionData.length) return <p>No data available for regions.</p>;

  const refreshData = () => setDataVersion((v) => v + 1);

  // Get available years from data
  const availableYears = [...new Set(data.map(item => item.year))].sort();
  const minYear = Math.min(...availableYears);
  const maxYear = Math.max(...availableYears);

  // Prepare filtered data for bar chart
  const filteredYearData = data
    .filter(yearData => yearData.year >= yearRange.start && yearData.year <= yearRange.end)
    .map(yearData => {
      const year = yearData.year;

      let total = 0;
      let regionBreakdown = [];

      if (selectedRegion === "all") {
        // Calculate total for all regions
        total = regionData.reduce((sum, region) => {
          const value = Number(yearData[region.actualKey]) || 0;
          return sum + value;
        }, 0);
        
        // Get breakdown for all regions
        regionBreakdown = regionData
          .filter(region => (Number(yearData[region.actualKey]) || 0) > 0)
          .map(region => ({
            name: region.name,
            value: Number(yearData[region.actualKey]) || 0
          }))
          .sort((a, b) => b.value - a.value);
      } else {
        // Calculate total for selected region only
        const selectedRegionData = regionData.find(region => region.name === selectedRegion);
        if (selectedRegionData) {
          total = Number(yearData[selectedRegionData.actualKey]) || 0;
          regionBreakdown = [{
            name: selectedRegionData.name,
            value: total
          }];
        }
      }

      return {
        year: year,
        total: total,
        regionBreakdown: regionBreakdown
      };
    })
    .sort((a, b) => a.year - b.year);

  const bubbleData = regionData.map((r, index) => ({
    region: r.name,
    total: r.total,
    index: index + 1,
    size: Math.sqrt(r.total) / 20,
  }));

  // Region Filter Component - Simple Dropdown
  const RegionFilter = () => {
    return (
      <div style={{ marginTop: "5px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "500", minWidth: "60px" }}>Region:</label>
          
          {/* Simple Dropdown */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
              minWidth: "250px",
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            <option value="all">All Regions</option>
            {availableRegionKeys.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <span style={{ fontSize: "0.9rem", color: "#666" }}>
            {selectedRegion === "all" 
              ? "Showing all regions" 
              : `Showing: ${selectedRegion}`
            }
          </span>
        </div>
      </div>
    );
  };

  // Year Range Filter Component
  const YearRangeFilter = () => {
    return (
      <div style={{ marginBottom: "15px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "500", minWidth: "80px" }}>Year Range:</label>
          <select
            value={yearRange.start}
            onChange={(e) => setYearRange(prev => ({ ...prev, start: parseInt(e.target.value) }))}
            style={{
              padding: "6px 10px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
            }}
          >
            {availableYears.map(year => (
              <option key={`start-${year}`} value={year}>{year}</option>
            ))}
          </select>
          <span>to</span>
          <select
            value={yearRange.end}
            onChange={(e) => setYearRange(prev => ({ ...prev, end: parseInt(e.target.value) }))}
            style={{
              padding: "6px 10px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
            }}
          >
            {availableYears.map(year => (
              <option key={`end-${year}`} value={year}>{year}</option>
            ))}
          </select>
          <span style={{ fontSize: "0.9rem", color: "#666" }}>
            ({filteredYearData.length} years shown)
          </span>
        </div>
      </div>
    );
  };

  //Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: '400px',
          maxHeight: '500px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '8px', flexShrink: 0 }}>
            <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
              Year: <strong>{label}</strong>
            </p>
            <p style={{ marginBottom: '0', fontSize: '14px' }}>
              Total Emigrants: <strong>{data.total.toLocaleString()}</strong>
            </p>
          </div>
          {data.regionBreakdown && data.regionBreakdown.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <p style={{ 
                fontWeight: 'bold', 
                marginBottom: '6px', 
                fontSize: '13px',
                flexShrink: 0 
              }}>
                {selectedRegion === "all" ? "Regional Breakdown:" : "Region:"}
              </p>
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                maxHeight: '300px',
                paddingRight: '4px'
              }}>
                {data.regionBreakdown.map((region, index) => (
                  <div 
                    key={index} 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      fontSize: '12px',
                      borderBottom: index < data.regionBreakdown.length - 1 ? '1px solid #f0f0f0' : 'none',
                      minHeight: '24px'
                    }}
                  >
                    <span style={{ 
                      flex: 1, 
                      marginRight: '10px',
                      wordWrap: 'break-word'
                    }}>
                      {region.name}
                    </span>
                    <span style={{ 
                      fontWeight: 'bold', 
                      minWidth: '70px', 
                      textAlign: 'right',
                      flexShrink: 0
                    }}>
                      {region.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page-content">
      <div className="page-header mb-8">
      </div>

      {/* --- Chart Section --- */}
      <section className="charts-section grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Bar Chart - Years 1988-2020 */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>
              {selectedRegion === "all" 
                ? `Total Emigrants by Year (${yearRange.start}-${yearRange.end})`
                : `${selectedRegion} Emigrants by Year (${yearRange.start}-${yearRange.end})`
              }
            </h3>
            <p>
              {selectedRegion === "all" 
                ? "Yearly distribution of emigrants with regional breakdown"
                : `Yearly distribution of emigrants from ${selectedRegion}`
              }
            </p>
          </div>
          
          {/* Year Range Filter */}
          <YearRangeFilter />
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={filteredYearData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ 
                  value: 'Total Emigrants', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend />
              <Bar 
                dataKey="total" 
                fill="#6366f1" 
                radius={[6, 6, 0, 0]}
                name="Total Emigrants"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Region Filter - Simple Dropdown */}
          <RegionFilter />
        </div>

        {/* Bubble Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Regional Distribution</h3>
            <p>Each bubble represents a region — size indicates total emigrants (all years)</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 80, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="region"
                type="category"
                name="Region"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis
                dataKey="total"
                name="Total Emigrants"
                tick={{ fontSize: 12 }}
              />
              <ZAxis dataKey="size" range={[100, 2000]} name="Bubble Size" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value, name) => {
                  if (name === "total")
                    return [value.toLocaleString(), "Total Emigrants"];
                  return [value, name];
                }}
              />
              <Legend />
              <Scatter data={bubbleData} name="Regions">
                {bubbleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColorForRegion(entry.region)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* --- Table Section --- */}
      <section className="table-section mt-8">
        <h2 className="section-title">Region of Origin Data Records</h2>
        <DynamicEmigrantsTable 
        service="origin" 
        onDataAdded={refreshData}/>
      </section>
    </div>
  );
};

export default OriginPage;