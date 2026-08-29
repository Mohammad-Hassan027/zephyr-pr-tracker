/**
 * Domain & unit tests for auth services and policy modules.
 * Runs without a database connection or running HTTP server.
 */

import assert from "node:assert";
import process from "node:process";

// Set environment for test
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "super-secret-key-at-least-32-chars-long!!";
process.env.PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || "platform-admin-test-password";

import {
  getAuthSecret,
  signToken,
  verifyToken,
  decodeTokenUnchecked,
} from "../auth/token.service.js";

import {
  createSessionToken,
  extractBearerToken,
  isValidPlatformAdminPassword,
} from "../auth/session.service.js";

import {
  isClubAdmin,
  isPlatformAdmin,
  ownsClub,
  canManageClub,
} from "../policies/club.policy.js";

import {
  isPRMember,
  canChangePIN,
  canManageMember,
  validatePinPolicy,
} from "../policies/member.policy.js";

function test(name, fn) {
  try {
    fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    console.error(`✖ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  console.log("\n=== RUNNING AUTH DOMAIN & POLICY UNIT TESTS ===");

  // 1. Token Service Primitives
  test("getAuthSecret loads secret correctly", () => {
    const secret = getAuthSecret();
    assert.strictEqual(typeof secret, "string");
    assert.ok(secret.length >= 32);
  });

  test("signToken and verifyToken round-trip", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { role: "club", clubId: "club123", iat: now, exp: now + 3600 };
    const token = signToken(payload);
    assert.strictEqual(typeof token, "string");
    assert.ok(token.includes("."));

    const verified = verifyToken(token);
    assert.strictEqual(verified.role, "club");
    assert.strictEqual(verified.clubId, "club123");
  });

  test("verifyToken rejects expired tokens", () => {
    const past = Math.floor(Date.now() / 1000) - 100;
    const token = signToken({ role: "club", clubId: "club123", iat: past - 3600, exp: past });
    assert.throws(() => verifyToken(token), /Session expired/);
  });

  test("verifyToken rejects tampered signatures", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signToken({ role: "club", clubId: "club123", iat: now, exp: now + 3600 });
    const tampered = token + "modified";
    assert.throws(() => verifyToken(tampered), /Invalid session/);
  });

  test("verifyToken rejects malformed token strings", () => {
    assert.throws(() => verifyToken("invalid-token-string"), /Invalid session/);
    assert.throws(() => verifyToken(""), /Invalid session/);
    assert.throws(() => verifyToken(null), /Invalid session/);
  });

  test("decodeTokenUnchecked parses body without verification", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signToken({ role: "pr", code: "PR001", iat: now, exp: now + 3600 });
    const decoded = decodeTokenUnchecked(token);
    assert.strictEqual(decoded.role, "pr");
    assert.strictEqual(decoded.code, "PR001");
  });

  // 2. Session Service Helpers
  test("createSessionToken automatically populates iat and exp", () => {
    const token = createSessionToken({ role: "platform_admin" });
    const claims = verifyToken(token);
    assert.strictEqual(claims.role, "platform_admin");
    assert.ok(claims.iat <= Math.floor(Date.now() / 1000));
    assert.ok(claims.exp > Math.floor(Date.now() / 1000));
  });

  test("extractBearerToken parses Authorization headers", () => {
    const mockReq = { get: (header) => (header === "authorization" ? "Bearer secret_token_123" : null) };
    assert.strictEqual(extractBearerToken(mockReq), "secret_token_123");

    const mockBadScheme = { get: () => "Basic secret_token_123" };
    assert.strictEqual(extractBearerToken(mockBadScheme), null);

    const mockEmpty = { get: () => null };
    assert.strictEqual(extractBearerToken(mockEmpty), null);
  });

  test("isValidPlatformAdminPassword performs timing-safe password check", () => {
    assert.strictEqual(isValidPlatformAdminPassword("platform-admin-test-password"), true);
    assert.strictEqual(isValidPlatformAdminPassword("wrong-password"), false);
    assert.strictEqual(isValidPlatformAdminPassword(""), false);
  });

  // 3. Policy Modules: Club Policy
  test("Club Policy: isClubAdmin", () => {
    assert.strictEqual(isClubAdmin({ role: "club" }), true);
    assert.strictEqual(isClubAdmin({ role: "admin" }), true);
    assert.strictEqual(isClubAdmin({ role: "pr" }), false);
    assert.strictEqual(isClubAdmin(null), false);
  });

  test("Club Policy: ownsClub", () => {
    assert.strictEqual(ownsClub({ role: "club", clubId: "club_1" }, "club_1"), true);
    assert.strictEqual(ownsClub({ role: "club", clubId: "club_1" }, "club_2"), false);
    assert.strictEqual(ownsClub(null, "club_1"), false);
  });

  test("Club Policy: canManageClub", () => {
    assert.strictEqual(canManageClub({ role: "platform_admin" }, "club_1"), true);
    assert.strictEqual(canManageClub({ role: "club", clubId: "club_1" }, "club_1"), true);
    assert.strictEqual(canManageClub({ role: "club", clubId: "club_1" }, "club_2"), false);
    assert.strictEqual(canManageClub({ role: "pr", clubId: "club_1" }, "club_1"), false);
  });

  // 4. Policy Modules: Member Policy
  test("Member Policy: isPRMember & canChangePIN", () => {
    assert.strictEqual(isPRMember({ role: "pr" }), true);
    assert.strictEqual(isPRMember({ role: "club" }), false);
    assert.strictEqual(canChangePIN({ role: "pr", code: "PR1" }), true);
    assert.strictEqual(canChangePIN({ role: "club" }), false);
  });

  test("Member Policy: canManageMember", () => {
    assert.strictEqual(canManageMember({ role: "club", clubId: "club_A" }, "club_A"), true);
    assert.strictEqual(canManageMember({ role: "club", clubId: "club_A" }, "club_B"), false);
    assert.strictEqual(canManageMember({ role: "pr", clubId: "club_A" }, "club_A"), false);
  });

  test("Member Policy: validatePinPolicy", () => {
    // Missing or invalid types
    assert.strictEqual(validatePinPolicy(null).valid, false);
    assert.strictEqual(validatePinPolicy("").valid, false);
    assert.strictEqual(validatePinPolicy("  ").valid, false);

    // Non-numeric
    assert.strictEqual(validatePinPolicy("123a").valid, false);
    assert.strictEqual(validatePinPolicy("abcd").valid, false);

    // Too short / long
    assert.strictEqual(validatePinPolicy("123").valid, false);
    assert.strictEqual(validatePinPolicy("1234567890123").valid, false);

    // Repeated digits
    assert.strictEqual(validatePinPolicy("0000").valid, false);
    assert.strictEqual(validatePinPolicy("111111").valid, false);

    // Sequential digits
    assert.strictEqual(validatePinPolicy("1234").valid, false);
    assert.strictEqual(validatePinPolicy("4321").valid, false);
    assert.strictEqual(validatePinPolicy("987654").valid, false);

    // Weak patterns
    assert.strictEqual(validatePinPolicy("1212").valid, false);
    assert.strictEqual(validatePinPolicy("112233").valid, false);

    // Strong valid PINs
    assert.strictEqual(validatePinPolicy("8492").valid, true);
    assert.strictEqual(validatePinPolicy("918273").valid, true);
    assert.strictEqual(validatePinPolicy("5719").valid, true);
  });

  console.log("=== ALL AUTH DOMAIN & POLICY TESTS PASSED ===");
}

runTests();
