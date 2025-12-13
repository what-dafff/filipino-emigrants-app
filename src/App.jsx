import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Papa from "papaparse";
import { Filter, Upload, Plus, Download, X, BarChart3, TrendingUp } from "lucide-react";
import "./style.css";

import Sidebar from "./components/layout/Sidebar";
import ForecastPanel from "./components/forecasting/ForecastPanel";
import OverviewDashboard from "./components/dashboard/overviewDashboard";
import AddEmigrantRecord from "./components/tables/addEmigrantRecord";

// Pages
import AgeGroupPage from "./pages/agegroupPage";
import CivilStatusPage from "./pages/civilstatusPage";
import EducationPage from "./pages/educationPage";
import SexPage from "./pages/sexPage";
import OccupationPage from "./pages/occupationPage";
import OriginPage from "./pages/originPage";
import DestinationCountryPage from "./pages/destinationCountryPage";
import AllCountriesPage from "./pages/allCountriesPage";

// Services
import { addEmigrant as addAge, getEmigrants as getAges } from "./services/age";
import { addEmigrant as addCivil, getEmigrants as getCivils } from "./services/civilStatus";
import { addEmigrant as addEducation, getEmigrants as getEducations } from "./services/education";
import { addEmigrant as addSex, getEmigrants as getSexes } from "./services/sex";
import { addEmigrant as addOccupation, getEmigrants as getOccupations } from "./services/occupation";
import { addEmigrant as addOrigin, getEmigrants as getOrigins } from "./services/origin";
import { addEmigrant as addMajorCountry, getEmigrants as getMajorCountrys } from "./services/majorCountry";
import { addEmigrant as addAllCountries, getEmigrants as getAllCountrys } from "./services/allCountries";

function App() {
  const [emigrants, setEmigrants] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Store civil status data for forecasting
  const [civilStatusData, setCivilStatusData] = useState([]);

  // Dataset handlers mapping
  const datasetHandlers = {
    age: { get: getAges, add: addAge },
    civilStatus: { get: getCivils, add: addCivil },
    education: { get: getEducations, add: addEducation },
    sex: { get: getSexes, add: addSex },
    occupation: { get: getOccupations, add: addOccupation },
    origin: { get: getOrigins, add: addOrigin },
    majorCountry: { get: getMajorCountrys, add: addMajorCountry },
    allCountries: { get: getAllCountrys, add: addAllCountries },
  };

  // Load data for the active page
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!activePage) {
        setEmigrants([]);
        return;
      }

      setLoading(true);
      try {
        const handler = datasetHandlers[activePage]?.get;
        if (!handler) {
          console.warn(`No handler for ${activePage}`);
          return;
        }

        const data = await handler();
        if (!mounted) return;

        // Normalize numeric values
        const normalized = (data || [])
          .map((d) => {
            const row = {};
            Object.keys(d).forEach((k) => {
              const value = d[k];
              if (k.toLowerCase() === "year" || k === "Year") {
                row.year = Number(value) || 0;
              } else {
                const numValue =
                  typeof value === "string"
                    ? parseFloat(value.replace(/[, ]/g, ""))
                    : Number(value);
                row[k] = isNaN(numValue) ? 0 : numValue;
              }
            });
            return row;
          })
          .sort((a, b) => a.year - b.year);

        // If it's civil status data, store it separately for forecasting
        if (activePage === "civilStatus") {
          setCivilStatusData(normalized);
        }

        setEmigrants(normalized);
      } catch (error) {
        console.error(`Error fetching ${activePage} data:`, error);
        toast.error(`Failed to fetch ${activePage} data.`);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [activePage, dataVersion]);

  // Load civil status data specifically for forecasting 
  useEffect(() => {
    let mounted = true;

    const loadCivilStatusData = async () => {
      try {
        const data = await getCivils();
        if (!mounted) return;

        const normalized = (data || [])
          .map((d) => {
            const row = {};
            Object.keys(d).forEach((k) => {
              const value = d[k];
              if (k.toLowerCase() === "year" || k === "Year") {
                row.year = Number(value) || 0;
              } else {
                const numValue =
                  typeof value === "string"
                    ? parseFloat(value.replace(/[, ]/g, ""))
                    : Number(value);
                row[k] = isNaN(numValue) ? 0 : numValue;
              }
            });
            return row;
          })
          .sort((a, b) => a.year - b.year);

        setCivilStatusData(normalized);
      } catch (error) {
        console.error("Error loading civil status data for forecasting:", error);
      }
    };

    loadCivilStatusData();
    return () => {
      mounted = false;
    };
  }, [dataVersion]);

  // --- Fetch Data (legacy trigger preserved) ---
  const fetchData = async () => {
    setLoading(true);
    try {
      if (!activePage) {
        setEmigrants([]);
        return;
      }
      const handler = datasetHandlers[activePage]?.get;
      if (!handler) throw new Error(`No data handler found for: ${activePage}`);
      const data = await handler();
      setEmigrants(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- CSV Upload (kept as-is) ---
  const handleCsvChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handleCsvUpload = () => {
    if (!csvFile) return;

    if (!activePage || !datasetHandlers[activePage]?.add) {
      toast.error("Please select a dataset page before uploading CSV.");
      return;
    }

    const handler = datasetHandlers[activePage].add;

    setLoading(true);
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
            .filter((r) => Object.values(r).some((v) => v !== ""))
            .map((row) =>
              Object.fromEntries(
                Object.entries(row)
                  .filter(
                    ([key, value]) =>
                      key && key.trim() !== "" && !key.startsWith("Unnamed")
                  )
                  .map(([key, value]) => [key.trim(), value])
              )
            );

          if (!rows.length) {
            toast.warn("No valid rows found in CSV.");
            return;
          }

          for (const row of rows) {
            if (Object.keys(row).length > 0) {
              await handler(row);
            }
          }

          toast.success("CSV uploaded successfully!");
          setCsvFile(null);
          setShowCsvModal(false);
          setDataVersion((prev) => prev + 1);
        } catch (error) {
          console.error("Error uploading CSV:", error);
          toast.error("Failed to upload CSV file.");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Dropdowns
  const uniqueYears = [...new Set(emigrants.map((e) => e.year))].sort();
  const uniqueProvinces = [
    ...new Set(emigrants.map((e) => e.province).filter(Boolean)),
  ].sort();

  return (
    <div className="dashboard-wrapper">
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        uniqueYears={uniqueYears}
        uniqueProvinces={uniqueProvinces}
        showForecastOption={true}
      />

      {/* Main Content */}
      <main className="main-content">
        <header className="dashboard-header">
          <div className="header-left">
            <h1 className="page-title">
              {activePage === "forecast" ? (
                <>
                  <span>Civil Status Forecasting</span>
                </>
              ) : activePage ? (
                `${activePage
                  .charAt(0)
                  .toUpperCase() + activePage.slice(1).replace(/([A-Z])/g, " $1")} Statistics`
              ) : (
                "Filipino Emigrants Overview"
              )}
            </h1>
            {activePage && activePage !== "forecast" && (
              <div className="dataset-info">
                <span className="data-count">{emigrants.length} records</span>
                <span className="year-range">
                  {uniqueYears.length > 0
                    ? `${uniqueYears[0]} - ${uniqueYears[uniqueYears.length - 1]}`
                    : ""}
                </span>
              </div>
            )}
          </div>
          <div className="header-actions">
            {activePage && activePage !== "forecast" && (
              <button onClick={() => setShowCsvModal(true)} className="btn-upload">
                <Upload size={18} />
                Import CSV
              </button>
            )}
            {activePage === "forecast" && civilStatusData.length > 0 && (
              <div className="forecast-info">
                <span className="data-ready">
                  Civil Status data loaded ({civilStatusData.length} records)
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page Routing */}
        {activePage === "forecast" && (
          <ForecastPanel
            data={civilStatusData}
            datasetName="Civil Status"
          />
        )}

        {activePage === "age" && <AgeGroupPage dataVersion={dataVersion} />}
        {activePage === "civilStatus" && <CivilStatusPage dataVersion={dataVersion} />}
        {activePage === "education" && <EducationPage dataVersion={dataVersion} />}
        {activePage === "sex" && <SexPage dataVersion={dataVersion} />}
        {activePage === "origin" && <OriginPage dataVersion={dataVersion} />}
        {activePage === "occupation" && <OccupationPage dataVersion={dataVersion} />}
        {activePage === "majorCountry" && <DestinationCountryPage dataVersion={dataVersion} />}
        {activePage === "allCountries" && <AllCountriesPage dataVersion={dataVersion} />}

        {/* Overview Dashboard */}
        {!activePage && (
          <OverviewDashboard
            emigrants={emigrants}
            dataVersion={dataVersion}
            onNavigateToDataset={(dataset) => setActivePage(dataset)}
          />
        )}
      </main>

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <div className="modal-header">
              <h2>Import CSV Data</h2>
              <button onClick={() => setShowCsvModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-actions">
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv"
                  onChange={handleCsvChange}
                  className="file-input"
                />
                <label htmlFor="csv-upload" className="file-label">
                  <Download size={18} />
                  {csvFile ? csvFile.name : "Choose CSV file"}
                </label>
                <button onClick={handleCsvUpload} disabled={!csvFile} className="btn-upload">
                  Upload File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
