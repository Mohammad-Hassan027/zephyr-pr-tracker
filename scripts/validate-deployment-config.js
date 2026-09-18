#!/usr/bin/env node
/**
 * Canonical Deployment Configuration & Blueprint Validator
 *
 * Validates:
 * 1. `render.yaml` (Canonical Backend Infrastructure-as-Code Blueprint)
 * 2. `Procfile` (Compatibility/Development-Only fallback definition)
 * 3. Environment templates parity (backend/.env.example, frontend/.env.*.example)
 * 4. Alignment between package.json scripts and deployment startup targets
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assertCondition(condition, message, details = "") {
  if (condition) {
    console.log(`  ✔ ${message}`);
    passed++;
  } else {
    console.error(`  ✖ ${message}`);
    if (details) console.error(`    ${details}`);
    failed++;
  }
}

function parseSimpleYaml(content) {
  const result = { services: [] };
  let currentService = null;
  let inEnvVars = false;
  let currentEnvVar = null;

  const lines = content.split(/\r?\n/);
  for (let rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const trimmed = line.trim();

    if (trimmed.startsWith("- type:")) {
      currentService = { type: trimmed.split(":")[1].trim(), envVars: [] };
      result.services.push(currentService);
      inEnvVars = false;
      continue;
    }

    if (currentService) {
      if (trimmed.startsWith("envVars:")) {
        inEnvVars = true;
        continue;
      }

      if (inEnvVars) {
        if (trimmed.startsWith("- key:")) {
          currentEnvVar = { key: trimmed.replace("- key:", "").trim() };
          currentService.envVars.push(currentEnvVar);
          continue;
        } else if (currentEnvVar && trimmed.startsWith("value:")) {
          currentEnvVar.value = trimmed.replace("value:", "").trim().replace(/^['"]|['"]$/g, "");
          continue;
        } else if (currentEnvVar && trimmed.startsWith("sync:")) {
          currentEnvVar.sync = trimmed.replace("sync:", "").trim() === "true";
          continue;
        }
      }

      const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match && !inEnvVars) {
        const key = match[1];
        const val = match[2].trim().replace(/^['"]|['"]$/g, "");
        currentService[key] = val;
      }
    }
  }

  return result;
}

function parseEnvFileKeys(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const keys = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)\s*=/);
    if (match) {
      keys.push(match[1]);
    }
  }
  return keys;
}

async function runAudit() {
  console.log("================================================================================");
  console.log("  ZEPHYR DEPLOYMENT SPECIFICATION & BLUEPRINT AUDIT");
  console.log("================================================================================\n");

  // 1. Audit Canonical render.yaml
  console.log("[1] Validating Canonical Blueprint: render.yaml");
  const renderYamlPath = path.join(ROOT_DIR, "render.yaml");
  assertCondition(fs.existsSync(renderYamlPath), "render.yaml exists in repository root");

  const renderContent = fs.readFileSync(renderYamlPath, "utf-8");
  assertCondition(
    renderContent.includes("CANONICAL DEPLOYMENT BLUEPRINT") || renderContent.includes("CANONICAL"),
    "render.yaml has explicit canonical declaration header"
  );

  const parsedRender = parseSimpleYaml(renderContent);
  assertCondition(
    Array.isArray(parsedRender.services) && parsedRender.services.length > 0,
    "render.yaml defines at least one service"
  );

  const backendService = parsedRender.services.find((s) => s.name === "zephyr-backend" || s.type === "web");
  assertCondition(Boolean(backendService), "render.yaml defines backend web service (zephyr-backend)");

  if (backendService) {
    assertCondition(backendService.runtime === "node", "Backend service runtime is 'node'");
    assertCondition(backendService.healthCheckPath === "/healthz", "Backend healthCheckPath is '/healthz'");
    assertCondition(
      backendService.buildCommand === "cd backend && npm install",
      `Backend buildCommand is 'cd backend && npm install' (actual: '${backendService.buildCommand}')`
    );
    assertCondition(
      backendService.startCommand === "cd backend && npm start",
      `Backend startCommand is 'cd backend && npm start' (actual: '${backendService.startCommand}')`
    );

    const envKeys = (backendService.envVars || []).map((e) => e.key);
    const requiredEnvKeys = [
      "NODE_ENV",
      "PORT",
      "MONGO_URI",
      "CLIENT_ORIGIN",
      "CLIENT_URL",
      "AUTH_SECRET",
      "PLATFORM_ADMIN_PASSWORD",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "CLOUDINARY_UPLOAD_PRESET",
      "EMAIL_PROVIDER",
      "EMAIL_FROM",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_SECURE",
    ];

    for (const reqKey of requiredEnvKeys) {
      assertCondition(
        envKeys.includes(reqKey),
        `render.yaml specifies environment variable '${reqKey}'`
      );
    }
  }

  // 2. Audit Procfile (Compatibility / Development-Only)
  console.log("\n[2] Validating Compatibility Process Specification: Procfile");
  const procfilePath = path.join(ROOT_DIR, "Procfile");
  assertCondition(fs.existsSync(procfilePath), "Procfile exists for backward compatibility");

  const procfileContent = fs.readFileSync(procfilePath, "utf-8");
  assertCondition(
    procfileContent.includes("COMPATIBILITY") &&
      (procfileContent.includes("render.yaml") || procfileContent.includes("CANONICAL")),
    "Procfile contains explicit compatibility-only disclaimer referencing render.yaml"
  );

  const procfileWebLine = procfileContent
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith("web:"));
  assertCondition(Boolean(procfileWebLine), "Procfile defines 'web:' process command");

  if (procfileWebLine && backendService) {
    const procfileCmd = procfileWebLine.replace(/^web:\s*/, "").trim();
    assertCondition(
      procfileCmd === backendService.startCommand,
      `Procfile web command matches render.yaml startCommand ('${procfileCmd}' === '${backendService.startCommand}')`
    );
  }

  // 3. Audit Backend Local Dev Environment Template (.env.example)
  console.log("\n[3] Validating Backend Environment Template: backend/.env.example");
  const backendEnvExamplePath = path.join(ROOT_DIR, "backend", ".env.example");
  assertCondition(fs.existsSync(backendEnvExamplePath), "backend/.env.example exists");

  const backendEnvExampleContent = fs.readFileSync(backendEnvExamplePath, "utf-8");
  assertCondition(
    backendEnvExampleContent.includes("CANONICAL DEPLOYMENT BLUEPRINT: ../render.yaml") ||
      backendEnvExampleContent.includes("render.yaml"),
    "backend/.env.example references canonical render.yaml"
  );

  const backendEnvKeys = parseEnvFileKeys(backendEnvExamplePath);
  const coreBackendKeys = [
    "NODE_ENV",
    "PORT",
    "MONGO_URI",
    "CLIENT_ORIGIN",
    "CLIENT_URL",
    "AUTH_SECRET",
    "PLATFORM_ADMIN_PASSWORD",
    "EMAIL_PROVIDER",
  ];

  for (const key of coreBackendKeys) {
    assertCondition(
      backendEnvKeys.includes(key),
      `backend/.env.example documents '${key}'`
    );
  }

  // 4. Audit Frontend Environment Templates
  console.log("\n[4] Validating Frontend Environment Templates");
  const frontendLocalExamplePath = path.join(ROOT_DIR, "frontend", ".env.local.example");
  const frontendProdExamplePath = path.join(ROOT_DIR, "frontend", ".env.production.example");

  assertCondition(fs.existsSync(frontendLocalExamplePath), "frontend/.env.local.example exists");
  assertCondition(fs.existsSync(frontendProdExamplePath), "frontend/.env.production.example exists");

  const frontendProdKeys = parseEnvFileKeys(frontendProdExamplePath);
  for (const key of ["BACKEND_API_URL", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SITE_URL"]) {
    assertCondition(
      frontendProdKeys.includes(key),
      `frontend/.env.production.example defines Vercel variable '${key}'`
    );
  }

  // 5. Audit Package Scripts Startup Alignment
  console.log("\n[5] Validating Startup Scripts Alignment");
  const backendPkgPath = path.join(ROOT_DIR, "backend", "package.json");
  const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, "utf-8"));
  assertCondition(
    backendPkg.scripts && backendPkg.scripts.start === "node server.js",
    "backend/package.json 'start' script is 'node server.js'"
  );

  console.log("\n================================================================================");
  if (failed === 0) {
    console.log(`✅ ALL ${passed} DEPLOYMENT CONFIGURATION CHECKS PASSED`);
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.error(`❌ ${failed} DEPLOYMENT CONFIGURATION CHECKS FAILED (${passed} passed)`);
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("FATAL: Deployment configuration validation failed with error:", err);
  process.exit(1);
});
