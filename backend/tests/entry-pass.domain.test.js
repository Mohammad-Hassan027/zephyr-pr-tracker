import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "12345678901234567890123456789012";

import {
  issueEntryPassToken,
  verifyEntryPassToken,
  generatePassQrCodeDataUrl,
  generatePassQrCodeSvg,
  ENTRY_PASS_VERSION,
} from "../services/registrations/entry-pass.service.js";

test("Entry Pass Token & Security Domain Suite", async (t) => {
  const dummyRegistration = {
    _id: "65f01a2b3c4d5e6f7a8b9c0d",
    regNo: "ZEP-2026-0042",
    studentName: "Grace Hopper",
    studentEmail: "grace@navy.mil",
    studentPhone: "9876543210",
    amount: 150,
    status: "approved",
  };

  const dummyEvent = {
    _id: "65f01a2b3c4d5e6f7a8b9c0e",
    name: "Compilers Conference",
    slug: "compilers-2026",
  };

  const dummyClub = {
    _id: "65f01a2b3c4d5e6f7a8b9c0f",
    name: "Computer Pioneers",
    slug: "pioneers",
  };

  await t.test("1. Token issuance contains only minimal non-sensitive identifiers", async () => {
    const token = issueEntryPassToken({
      registration: dummyRegistration,
      event: dummyEvent,
      club: dummyClub,
      expiresInSeconds: 3600,
    });

    assert.ok(typeof token === "string");
    assert.ok(token.includes("."));

    const [bodyB64] = token.split(".");
    const decoded = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));

    // Expected minimal claims
    assert.strictEqual(decoded.v, ENTRY_PASS_VERSION);
    assert.strictEqual(decoded.t, "ep");
    assert.strictEqual(decoded.rid, String(dummyRegistration._id));
    assert.strictEqual(decoded.eid, String(dummyEvent._id));
    assert.strictEqual(decoded.cid, String(dummyClub._id));
    assert.strictEqual(decoded.seq, "ZEP-2026-0042");
    assert.ok(decoded.iat);
    assert.ok(decoded.exp);

    // CRITICAL SECURITY: Ensure NO private attendee PII is inside the token
    assert.strictEqual(decoded.studentName, undefined);
    assert.strictEqual(decoded.studentEmail, undefined);
    assert.strictEqual(decoded.studentPhone, undefined);
    assert.strictEqual(decoded.amount, undefined);
    assert.strictEqual(decoded.paymentScreenshot, undefined);
  });

  await t.test("2. Verification succeeds for genuine unexpired token", async () => {
    const token = issueEntryPassToken({
      registration: dummyRegistration,
      event: dummyEvent,
      club: dummyClub,
      expiresInSeconds: 600,
    });

    const verification = verifyEntryPassToken(token);
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.claims.rid, String(dummyRegistration._id));
    assert.strictEqual(verification.claims.seq, "ZEP-2026-0042");
  });

  await t.test("3. Forged signature is strictly rejected", async () => {
    const token = issueEntryPassToken({
      registration: dummyRegistration,
      event: dummyEvent,
      club: dummyClub,
    });

    const [bodyB64] = token.split(".");
    const forgedSignature = "invalid_forged_signature_xyz123";
    const forgedToken = `${bodyB64}.${forgedSignature}`;

    const verification = verifyEntryPassToken(forgedToken);
    assert.strictEqual(verification.valid, false);
    assert.ok(verification.error.includes("Invalid or forged entry pass signature"));
  });

  await t.test("4. Tampered payload is strictly rejected", async () => {
    const token = issueEntryPassToken({
      registration: dummyRegistration,
      event: dummyEvent,
      club: dummyClub,
    });

    const [bodyB64, sig] = token.split(".");
    const claims = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
    claims.seq = "ZEP-2026-9999"; // Attempted sequence tampering

    const tamperedBody = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const tamperedToken = `${tamperedBody}.${sig}`;

    const verification = verifyEntryPassToken(tamperedToken);
    assert.strictEqual(verification.valid, false);
    assert.ok(verification.error.includes("Invalid or forged entry pass signature"));
  });

  await t.test("5. Expired token is rejected with expiration reason", async () => {
    const expiredToken = issueEntryPassToken({
      registration: dummyRegistration,
      event: dummyEvent,
      club: dummyClub,
      expiresInSeconds: -10, // already expired 10 seconds ago
    });

    const verification = verifyEntryPassToken(expiredToken);
    assert.strictEqual(verification.valid, false);
    assert.ok(verification.error.includes("expired"));
  });

  await t.test("6. QR Code Data URL and SVG Generation", async () => {
    const token = issueEntryPassToken({
      registration: dummyRegistration,
      event: dummyEvent,
      club: dummyClub,
    });

    const dataUrl = await generatePassQrCodeDataUrl(token);
    assert.ok(dataUrl.startsWith("data:image/png;base64,"));

    const svg = await generatePassQrCodeSvg(token);
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("</svg>"));
  });
});