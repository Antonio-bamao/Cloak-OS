export function cloneRecord(record) {
  return structuredClone(record);
}

export function cloneRecords(records) {
  return records.map((record) => cloneRecord(record));
}
