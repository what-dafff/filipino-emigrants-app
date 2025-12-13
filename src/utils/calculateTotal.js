export function calculateTotal(record) {
  return (
    (parseFloat(record.single) || 0) +
    (parseFloat(record.married) || 0) +
    (parseFloat(record.widower) || 0) +
    (parseFloat(record.separated) || 0) +
    (parseFloat(record.divorced) || 0) +
    (parseFloat(record.notReported) || 0)
  );
}
