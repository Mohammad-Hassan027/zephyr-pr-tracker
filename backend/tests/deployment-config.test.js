/**
 * Deployment Configuration Parity & Blueprint Audit Test
 *
 * Verifies that:
 * 1. `render.yaml` contains all backend runtime environment variables validated in `config/env.js`.
 * 2. `Procfile` is explicitly marked compatibility-only and matches `render.yaml`'s startCommand.
 * 3. `.env.example` documents all required backend configuration variables.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");

test("Deployment Configuration Parity & Blueprint Audit", async (t) => {
  await t.test("render.yaml is canonical and contains required backend configurations", () => {
    const renderYamlPath = path.join(ROOT_DIR, "render.yaml");
    assert.ok(fs.existsSync(renderYamlPath), "render.yaml must exist at root");

    const content = fs.readFileSync(renderYamlPath, "utf-8");
    assert.ok(
      content.includes("CANONICAL DEPLOYMENT BLUEPRINT"),
      "render.yaml must have canonical deployment header"
    );
    assert.ok(content.includes("healthCheckPath: /healthz"), "Health check path must be /healthz");
    assert.ok(content.includes("startCommand: cd backend && npm start"), "Start command must match cd backend && npm start");
    assert.ok(content.includes("buildCommand: cd backend && npm install"), "Build command must match cd backend && npm install");

    const expectedKeys = [
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

    for (const key of expectedKeys) {
      assert.ok(
        content.includes(`key: ${key}`),
        `render.yaml must declare environment variable: ${key}`
      );
    }
  });

  await t.test("Procfile is marked as compatibility-only and matches render.yaml startCommand", () => {
    const procfilePath = path.join(ROOT_DIR, "Procfile");
    assert.ok(fs.existsSync(procfilePath), "Procfile must exist");

    const content = fs.readFileSync(procfilePath, "utf-8");
    assert.ok(
      content.includes("COMPATIBILITY & LOCAL DEVELOPMENT ONLY"),
      "Procfile must contain compatibility disclaimer"
    );
    assert.ok(
      content.includes("CANONICAL DEPLOYMENT BLUEPRINT: render.yaml"),
      "Procfile must reference render.yaml as canonical"
    );

    const webLine = content.split(/\r?\n/).find((l) => l.trim().startsWith("web:"));
    assert.ok(webLine, "Procfile must define web process");
    assert.equal(webLine.trim(), "web: cd backend && npm start");
  });

  await t.test("backend/.env.example documents core configuration and references render.yaml", () => {
    const envExamplePath = path.join(ROOT_DIR, "backend", ".env.example");
    assert.ok(fs.existsSync(envExamplePath), "backend/.env.example must exist");

    const content = fs.readFileSync(envExamplePath, "utf-8");
    assert.ok(
      content.includes("CANONICAL DEPLOYMENT BLUEPRINT: ../render.yaml"),
      "backend/.env.example must reference canonical render.yaml"
    );

    const requiredKeys = [
      "NODE_ENV",
      "PORT",
      "MONGO_URI",
      "CLIENT_ORIGIN",
      "CLIENT_URL",
      "AUTH_SECRET",
      "PLATFORM_ADMIN_PASSWORD",
      "EMAIL_PROVIDER",
    ];

    for (const key of requiredKeys) {
      assert.ok(
        content.includes(`${key}=`),
        `backend/.env.example must document ${key}`
      );
    }
  });
});
