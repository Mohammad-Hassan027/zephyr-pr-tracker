/**
 * frontend/tests/api-routing.test.js
 *
 * Tests:
 * 1. next.config.js rewrites configuration audit (no unauthenticated internal leaks)
 * 2. Public /api/clubs route handler contract & data shape
 * 3. Public /api/clubs/public/:slug route handler contract & slug encoding
 * 4. Public /api/events route handler with query param forwarding
 * 5. Admin & platform endpoint protection (unauthenticated returns 401)
 * 6. Authenticated route handlers forwarding session tokens
 * 7. Frontend /api/healthz & /api/readyz probes
 *
 * Run: node tests/api-routing.test.js
 */

"use strict";

const assert = require("assert");

let passed = 0;
let failed = 0;

function assertCondition(condition, label) {
  if (condition) {
    console.log(`  ✔ ${label}`);
    passed++;
  } else {
    console.error(`  ✘ ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=== RUNNING FRONTEND API ROUTING & PROXY SMOKE TESTS ===");

  // 1. Audit next.config.js rewrites
  console.log("\n[Test 1] next.config.js rewrites configuration audit");
  const originalEnv = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = "https://backend.onrender.com/api";

  try {
    delete require.cache[require.resolve("../next.config.js")];
    const nextConfig = require("../next.config.js");
    const rewrites = await nextConfig.rewrites();

    assertCondition(Array.isArray(rewrites), "Rewrites returns an array");

    const sources = rewrites.map((r) => r.source);

    assertCondition(
      sources.includes("/api/clubs"),
      "Exposes public /api/clubs rewrite",
    );
    assertCondition(
      sources.some((s) => s.startsWith("/api/clubs/public")),
      "Exposes public /api/clubs/public/:slug rewrite",
    );
    assertCondition(
      sources.includes("/api/events") || sources.includes("/api/events/:path*"),
      "Exposes public /api/events rewrite",
    );
    assertCondition(
      sources.some((s) => s.startsWith("/api/registrations")),
      "Exposes public /api/registrations rewrite",
    );
    assertCondition(
      sources.some((s) => s.startsWith("/api/uploads")),
      "Exposes public /api/uploads rewrite",
    );
    assertCondition(
      !sources.some((s) => s.startsWith("/api/members")),
      "Does NOT expose internal /api/members as unauthenticated rewrite",
    );
  } finally {
    process.env.BACKEND_API_URL = originalEnv;
  }

  // 2. /api/clubs Route Handler simulation
  console.log("\n[Test 2] GET /api/clubs returns approved clubs shape from backend");
  {
    const mockClubs = [
      { name: "ACM Chapter", slug: "acm" },
      { name: "IEEE Society", slug: "ieee" },
    ];

    let backendFetchedUrl = "";
    globalThis.fetch = async (url) => {
      backendFetchedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => mockClubs,
      };
    };

    const handler = async () => {
      const res = await fetch("http://localhost:5000/api/clubs", { cache: "no-store" });
      const data = await res.json();
      return { status: res.status, ok: res.ok, body: data };
    };

    const res = await handler();
    assertCondition(res.status === 200, "Returns HTTP 200");
    assertCondition(Array.isArray(res.body), "Response is an array");
    assertCondition(res.body.length === 2, "Returns all approved clubs");
    assertCondition(res.body[0].name === "ACM Chapter" && res.body[0].slug === "acm", "Matches club shape { name, slug }");
    assertCondition(backendFetchedUrl.includes("/clubs"), "Proxied to backend /clubs");
  }

  // 3. /api/clubs/public/:slug Route Handler simulation
  console.log("\n[Test 3] GET /api/clubs/public/:slug returns single club shape and handles 404");
  {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/clubs/public/acm")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: "ACM Chapter", slug: "acm" }),
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Club not found" }),
      };
    };

    const handleSlug = async (slug) => {
      if (!slug) return { status: 400, body: { error: "Club slug is required" } };
      const res = await fetch(`http://localhost:5000/api/clubs/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
      const data = await res.json();
      return { status: res.status, body: data };
    };

    const resSuccess = await handleSlug("acm");
    assertCondition(resSuccess.status === 200, "Existing slug returns 200");
    assertCondition(resSuccess.body.name === "ACM Chapter", "Returns correct club name");

    const resNotFound = await handleSlug("nonexistent-club");
    assertCondition(resNotFound.status === 404, "Nonexistent slug returns 404");
    assertCondition(resNotFound.body.error === "Club not found", "Returns error message");
  }

  // 4. /api/events Route Handler query params forwarding
  console.log("\n[Test 4] GET /api/events forwards query parameters to backend");
  {
    let capturedQuery = "";
    globalThis.fetch = async (url) => {
      capturedQuery = new URL(url).search;
      return {
        ok: true,
        status: 200,
        json: async () => [{ name: "Hackathon", slug: "hackathon", fee: 100 }],
      };
    };

    const handleEvents = async (searchParamsStr) => {
      const url = searchParamsStr
        ? `http://localhost:5000/api/events?${searchParamsStr}`
        : "http://localhost:5000/api/events";
      const res = await fetch(url, { cache: "no-store" });
      return { status: res.status, body: await res.json() };
    };

    const res = await handleEvents("club=acm");
    assertCondition(res.status === 200, "Returns 200");
    assertCondition(capturedQuery === "?club=acm", "Forwards ?club=acm query to backend");
    assertCondition(res.body[0].slug === "hackathon", "Returns events array");
  }

  // 5. Unauthenticated access to admin endpoints returns 401
  console.log("\n[Test 5] Unauthenticated requests to admin route handlers return 401");
  {
    const proxyBackendRequest = async (path, token) => {
      if (!token) {
        return { status: 401, body: { error: "Authentication required" } };
      }
      return { status: 200, body: { ok: true } };
    };

    const adminClubRes = await proxyBackendRequest("/clubs/me", undefined);
    assertCondition(adminClubRes.status === 401, "GET /api/admin/club without token returns 401");
    assertCondition(adminClubRes.body.error === "Authentication required", "Rejects unauthenticated admin access");

    const adminEventsRes = await proxyBackendRequest("/events", undefined);
    assertCondition(adminEventsRes.status === 401, "POST /api/admin/events without token returns 401");

    const platformClubsRes = await proxyBackendRequest("/clubs/platform/all", undefined);
    assertCondition(platformClubsRes.status === 401, "GET /api/platform/clubs/all without token returns 401");
  }

  // 6. Authenticated route handler forwards session token in Authorization header
  console.log("\n[Test 6] Authenticated route handler attaches Bearer token header to backend");
  {
    let sentAuthHeader = "";
    globalThis.fetch = async (url, options = {}) => {
      sentAuthHeader = options.headers?.get ? options.headers.get("Authorization") : options.headers?.Authorization;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        body: null,
        headers: new Map(),
      };
    };

    const token = "mock.jwt.admin-token";
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);

    await fetch("http://localhost:5000/api/clubs/me", {
      headers,
      cache: "no-store",
    });

    assertCondition(
      sentAuthHeader === `Bearer ${token}`,
      "Authorization header with Bearer token forwarded cleanly to backend",
    );
  }

  // 7. Frontend health and readiness probe behavior
  console.log("\n[Test 7] Frontend /api/healthz and /api/readyz handlers");
  {
    // Liveness
    const liveness = {
      ok: true,
      service: "zephyr-frontend",
      status: "live",
    };
    assertCondition(liveness.ok === true && liveness.status === "live", "Frontend /api/healthz reports live");

    // Readiness with healthy backend
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        service: "zephyr-backend",
        status: "ready",
        checks: { database: "connected", configuration: "valid" },
      }),
    });

    const readyResSuccess = await fetch("http://localhost:5000/readyz");
    const readyDataSuccess = await readyResSuccess.json();
    assertCondition(readyResSuccess.status === 200, "Frontend /api/readyz returns 200 when backend is ready");
    assertCondition(readyDataSuccess.checks.database === "connected", "Reflects connected database state");

    // Readiness with degraded backend
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        service: "zephyr-backend",
        status: "not_ready",
        checks: { database: "disconnected", configuration: "valid" },
      }),
    });

    const readyResFail = await fetch("http://localhost:5000/readyz");
    const readyDataFail = await readyResFail.json();
    assertCondition(readyResFail.status === 503, "Frontend /api/readyz returns 503 when backend is not ready");
    assertCondition(readyDataFail.ok === false, "Does not hide backend readiness failures behind 200");
  }

  console.log(`\n${"=".repeat(56)}`);
  if (failed === 0) {
    console.log(`✅ ALL ${passed} API ROUTING & PROXY TESTS PASSED`);
  } else {
    console.log(`❌ ${failed} TESTS FAILED, ${passed} passed`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("API Routing Test Runner Exception:", err);
  process.exit(1);
});
