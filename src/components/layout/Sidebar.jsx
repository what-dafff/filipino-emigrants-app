import React from "react";
import {
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  Globe,
  User,
  GraduationCap,
  BookOpen,
  Plane,
  Home,
  History,
} from "lucide-react";

const Sidebar = ({ activePage, setActivePage, uniqueYears, uniqueProvinces }) => {
  const datasets = [
    {key: "age",  label: "Age Group", icon: <Globe size={18} /> },
    { key: "civilStatus", label: "Civil Status", icon: <User size={18} /> },
    { key: "education", label: "Educational Attainment", icon: <GraduationCap size={18} /> },
    { key: "sex", label: "Sex", icon: <User size={18} /> },
    { key: "occupation", label: "Occupation", icon: <BookOpen size={18} /> },
    { key: "majorCountry", label: "Major Destination Country", icon: <Plane size={18} /> },
    { key: "origin", label: "Place of Origin", icon: <Home size={18} /> },
    { key: "allCountries", label: "All Countries", icon: <History size={18} /> },
  ];

  return (
    <aside className="sidebar">
      {/* Logo / Header */}
      <div className="sidebar-header">
        <div className="logo-container">
          <Users className="logo-icon" />
          <h2 className="logo-text">Filipino Emigrants</h2>
        </div>
        <p className="logo-subtitle">Since 1981 - 2020</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Overview Button */}
        <button
          className={`nav-item ${!activePage ? "active" : ""}`}
          onClick={() => setActivePage(null)}
        >
          <TrendingUp size={18} />
          <span>Overview</span>
        </button>

        {/* Forecast Button */}
        <button
          className={`nav-item ${activePage === "forecast" ? "active" : ""}`}
          onClick={() => setActivePage("forecast")}
        >
          <Calendar size={18} />
          <span>Forecast (ML)</span>
        </button>

        {/* Datasets */}
        <div className="nav-group-title">Datasets ({datasets.length} Total)</div>

        {datasets.map((dataset) => (
          <button
            key={dataset.key}
            className={`nav-item ${activePage === dataset.key ? "active" : ""}`}
            onClick={() => setActivePage(dataset.key)}
          >
            {dataset.icon}
            <span>{dataset.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
