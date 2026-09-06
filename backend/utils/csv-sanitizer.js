/**
 * csv-sanitizer.js
 *
 * Utilities for generating RFC-4180 compliant CSV data with built-in defense
 * against CSV formula injection (also known as spreadsheet formula injection
 * or CSV injection).
 *
 * Prevents execution of formulas in Excel, Google Sheets, LibreOffice, etc.
 * when opening exported files.
 */

// UTF-8 Byte Order Mark for Excel compatibility
export const CSV_BOM = "\uFEFF";

// Dangerous characters that could trigger formula execution or command injection in spreadsheets
const DANGEROUS_PREFIX_REGEX = /^\s*([=+\-@\t\r\n|])/;

/**
 * Sanitizes an individual cell value for CSV output.
 *
 * - Null / undefined are converted to empty string.
 * - Dates are formatted as ISO 8601 strings.
 * - Numbers and booleans are converted to strings safely.
 * - Objects / Maps are serialized to JSON.
 * - Strings are trimmed check for formula triggers; if dangerous, prepends a single quote (').
 * - Inner quotes are doubled ("" per RFC-4180) and value is wrapped in double quotes.
 *
 * @param {any} value
 * @returns {string}
 */
export function sanitizeCsvValue(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '""';
    return `"${value.toISOString()}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  let str = "";
  if (typeof value === "object") {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }

  // Prevent CSV Formula Injection
  // If string begins with =, +, -, @, \t, \r, \n, or | (even after whitespace), neutralize it
  if (DANGEROUS_PREFIX_REGEX.test(str)) {
    str = `'${str}`;
  }

  // Double quotes escape and wrap in quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Formats an array of column values into a single CSV row terminating with \r\n.
 *
 * @param {Array<any>} rowArray
 * @returns {string}
 */
export function formatCsvRow(rowArray) {
  if (!Array.isArray(rowArray)) return "\r\n";
  return rowArray.map(sanitizeCsvValue).join(",") + "\r\n";
}

export default {
  CSV_BOM,
  sanitizeCsvValue,
  formatCsvRow,
};
