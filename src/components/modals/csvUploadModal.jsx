import React from 'react';
import Papa from 'papaparse';
import { toast } from 'react-toastify';
import { Upload, Download, X } from 'lucide-react';

const CsvUploadModal = ({ showCsvModal, setShowCsvModal, csvFile, setCsvFile, setLoading, fetchData, addEmigrant }) => {

    const handleCsvChange = (e) => {
        setCsvFile(e.target.files[0]);
    };

    // CSV Upload logic 
    const handleCsvUpload = () => {
        if (!csvFile) return;
        
        setLoading(true);
        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rows = results.data.filter(row => Object.values(row).some(val => val !== "")); // Filter empty rows
                    if (rows.length === 0) {
                        toast.warn("The CSV file is empty or contains no valid data.");
                        setLoading(false);
                        return;
                    }
                    
                    for (const row of rows) {
                        await addEmigrant(row);
                    }

                    await fetchData(); 
                    setCsvFile(null);
                    toast.success(`Successfully uploaded and saved ${rows.length} records!`);
                    setShowCsvModal(false);
                } catch (error) {
                    console.error("Error uploading CSV:", error);
                    toast.error("Failed to upload or save data. Check CSV format and Firebase connection.");
                } finally {
                    setLoading(false);
                }
            },
            error: (error) => {
                console.error("CSV parsing error:", error);
                toast.error("Failed to parse CSV file. Please check the format.");
                setLoading(false);
            }
        });
    };

    if (!showCsvModal) return null;

    return (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="modal-header">
                    <h2>Import CSV Data</h2>
                    <button onClick={() => setShowCsvModal(false)} className="modal-close">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="upload-header" style={{ marginBottom: 16 }}>
                        <div className="upload-icon">
                            <Upload size={24} />
                        </div>
                        <div>
                            <h3 className="upload-title">Bulk Import</h3>
                            <p className="upload-subtitle">Upload a CSV file to import emigrant records</p>
                        </div>
                    </div>
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
                            {csvFile ? csvFile.name : 'Choose CSV file'}
                        </label>
                        <button
                            onClick={handleCsvUpload}
                            disabled={!csvFile}
                            className="btn-upload"
                            style={{ marginTop: 12 }}
                        >
                            Upload File
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CsvUploadModal;