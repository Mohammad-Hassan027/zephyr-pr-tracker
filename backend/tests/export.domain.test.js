import "dotenv/config";
import assert from "node:assert/strict";
import {
  CSV_BOM,
  sanitizeCsvValue,
  formatCsvRow,
} from "../utils/csv-sanitizer.js";

async function runExportDomainUnitTests() {
  console.log("=== RUNNING EXPORT DOMAIN & CSV SANITIZATION UNIT TESTS ===");

  // 1. CSV Formula Injection Defense Tests
  console.log("\n[Test 1] CSV Formula Injection Neutralization:");

  const formulaEqual = "=SUM(1, 2)";
  const sanitizedEqual = sanitizeCsvValue(formulaEqual);
  assert.equal(sanitizedEqual, `"'=SUM(1, 2)"`, "Formula starting with = must be prefixed with single quote");

  const formulaPlus = "+1+2";
  const sanitizedPlus = sanitizeCsvValue(formulaPlus);
  assert.equal(sanitizedPlus, ` "'+1+2"`.trim(), "Formula starting with + must be prefixed with single quote");

  const formulaMinus = "-5+2";
  const sanitizedMinus = sanitizeCsvValue(formulaMinus);
  assert.equal(sanitizedMinus, ` "'-5+2"`.trim(), "Formula starting with - must be prefixed with single quote");

  const formulaAt = "@SUM(A1:A5)";
  const sanitizedAt = sanitizeCsvValue(formulaAt);
  assert.equal(sanitizedAt, `"'@SUM(A1:A5)"`, "Formula starting with @ must be prefixed with single quote");

  const formulaWithLeadingWhitespace = "   =cmd|' /C calc'!A0";
  const sanitizedWs = sanitizeCsvValue(formulaWithLeadingWhitespace);
  assert.ok(sanitizedWs.startsWith(`"'`), "Formulas with leading whitespace must be prefixed with single quote");
  assert.ok(sanitizedWs.includes("=cmd"), "Must retain formula text safely");

  const formulaTab = "\t=1+1";
  const sanitizedTab = sanitizeCsvValue(formulaTab);
  assert.ok(sanitizedTab.startsWith(`"'\t`), "Values starting with tab must be escaped");

  const formulaPipe = "|calc";
  const sanitizedPipe = sanitizeCsvValue(formulaPipe);
  assert.equal(sanitizedPipe, `"'|calc"`, "Values starting with pipe must be escaped");

  console.log("✔ Formula injection neutralization tests passed!");

  // 2. CSV RFC-4180 Escaping & Value Serialization Tests
  console.log("\n[Test 2] RFC-4180 Escaping & Value Formatting:");

  const normalText = "Aarav Sharma";
  assert.equal(sanitizeCsvValue(normalText), `"Aarav Sharma"`);

  const textWithQuotes = 'John "Doc" Doe';
  assert.equal(sanitizeCsvValue(textWithQuotes), `"John ""Doc"" Doe"`);

  const numberValue = 250;
  assert.equal(sanitizeCsvValue(numberValue), "250");

  const floatValue = 49.99;
  assert.equal(sanitizeCsvValue(floatValue), "49.99");

  const boolValue = true;
  assert.equal(sanitizeCsvValue(boolValue), "true");

  assert.equal(sanitizeCsvValue(null), '""');
  assert.equal(sanitizeCsvValue(undefined), '""');

  const testDate = new Date("2026-09-06T12:00:00.000Z");
  assert.equal(sanitizeCsvValue(testDate), `"2026-09-06T12:00:00.000Z"`);

  const customFieldsObj = { size: "L", collegeRoll: "CS-101" };
  const customFieldsSanitized = sanitizeCsvValue(customFieldsObj);
  assert.ok(customFieldsSanitized.startsWith('"{"size":""L"",""collegeRoll"":""CS-101""}"') || customFieldsSanitized.includes("CS-101"));

  console.log("✔ RFC-4180 formatting tests passed!");

  // 3. Row Formatting & BOM Tests
  console.log("\n[Test 3] Row Formatting & BOM Verification:");

  assert.equal(CSV_BOM, "\uFEFF", "CSV_BOM must be UTF-8 BOM");

  const sampleRow = ["REG-0001", "Aarav", 100, "approved"];
  const formattedRow = formatCsvRow(sampleRow);
  assert.equal(formattedRow, `"REG-0001","Aarav",100,"approved"\r\n`);

  console.log("✔ Row formatting and BOM tests passed!");

  console.log("\n=== ALL EXPORT DOMAIN UNIT TESTS PASSED ===");
}

runExportDomainUnitTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Export Domain Unit Test Failed:", err);
    process.exit(1);
  });
