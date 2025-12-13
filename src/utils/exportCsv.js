import { toast } from "react-toastify";

/**
 * @param {Array} data 
 * @param {string} filename 
 */
export const exportTableToCSV = (data, filename = "export.csv") => {
  if (!data || data.length === 0) {
    toast.warn("No data available to export.");
    return;
  }

  try {
    let headers = Object.keys(data[0]).filter(
      (key) => !["id", "_id", "_collection", "__typename"].includes(key)
    );

    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const yearKey = headers.find((h) => h.toLowerCase() === "year");
    const countryKey =
      headers.find(
        (h) => h.toLowerCase() === "country" || h.toLowerCase() === "country_name"
      ) || headers.find((h) => h === "COUNTRY");

    const orderedHeaders = [
      ...(countryKey ? [countryKey] : []),
      ...(yearKey ? [yearKey] : []),
      ...headers.filter(
        (h) => h !== countryKey && h !== yearKey
      ),
    ];

    const csvRows = [orderedHeaders.join(",")];

    for (const row of data) {
      const values = orderedHeaders.map((h) => {
        let val = row[h] ?? "";
        val = String(val).replace(/"/g, '""');
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          val = `"${val}"`;
        }
        return val;
      });
      csvRows.push(values.join(","));
    }

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.length} records to ${filename}`);
  } catch (err) {
    console.error("Export error:", err);
    toast.error("Failed to export CSV.");
  }
};
