import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  normalizePhone,
  normalizeUtr,
  normalizeName,
  calculateNameSimilarity,
} from "../services/registrations/duplicate-detection.service.js";

describe("Duplicate Detection & Normalization Domain Suite", () => {
  it("1. normalizeEmail correctly standardizes email inputs", () => {
    assert.equal(normalizeEmail("  User.Name@Example.COM  "), "user.name@example.com");
    assert.equal(normalizeEmail("student+tag@domain.org"), "student+tag@domain.org");
    assert.equal(normalizeEmail(""), "");
    assert.equal(normalizeEmail(null), "");
    assert.equal(normalizeEmail(undefined), "");
  });

  it("2. normalizePhone standardizes 10-digit Indian and mobile numbers", () => {
    assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
    assert.equal(normalizePhone("919876543210"), "9876543210");
    assert.equal(normalizePhone("09876543210"), "9876543210");
    assert.equal(normalizePhone("9876-543-210"), "9876543210");
    assert.equal(normalizePhone("9876543210"), "9876543210");
    assert.equal(normalizePhone(""), "");
    assert.equal(normalizePhone(null), "");
  });

  it("3. normalizeUtr sanitizes transaction identifiers", () => {
    assert.equal(normalizeUtr("  upi-1234-5678-abcd  "), "UPI12345678ABCD");
    assert.equal(normalizeUtr("PAY_REF_9988"), "PAYREF9988");
    assert.equal(normalizeUtr(" 123 456 789 "), "123456789");
    assert.equal(normalizeUtr(""), "");
    assert.equal(normalizeUtr(null), "");
  });

  it("4. normalizeName standardizes participant names", () => {
    assert.equal(normalizeName("  John   Doe  "), "john doe");
    assert.equal(normalizeName("O'Connor-Smith"), "oconnorsmith");
    assert.equal(normalizeName("Dr. Alice Walker, Jr."), "dr alice walker jr");
    assert.equal(normalizeName(""), "");
    assert.equal(normalizeName(null), "");
  });

  it("5. calculateNameSimilarity identifies close name variants and rejects dissimilar names", () => {
    // Identical
    assert.equal(calculateNameSimilarity("Mohammad Hassan", "Mohammad Hassan"), 1.0);
    assert.equal(calculateNameSimilarity("John Doe", "john doe"), 1.0);

    // Minor spelling differences / typos (> 0.85)
    const typoSimilarity = calculateNameSimilarity("Mohammad Hassan", "Mohammad Hasan");
    assert.ok(typoSimilarity >= 0.85, `Expected >= 0.85, got ${typoSimilarity}`);

    const middleInitialSimilarity = calculateNameSimilarity("John R. Smith", "John Smith");
    assert.ok(middleInitialSimilarity >= 0.75, `Expected >= 0.75, got ${middleInitialSimilarity}`);

    // Completely different (< 0.5)
    const differentSimilarity = calculateNameSimilarity("Alice Walker", "Bob Marley");
    assert.ok(differentSimilarity < 0.5, `Expected < 0.5, got ${differentSimilarity}`);
  });
});
