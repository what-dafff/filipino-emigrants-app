import React from 'react';
import { ToastContainer } from 'react-toastify';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import 'leaflet/dist/leaflet.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ToastContainer position="top-right" autoClose={3000} />
  </React.StrictMode>
);