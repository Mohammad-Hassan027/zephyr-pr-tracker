import crypto from "node:crypto";

const TOKEN_BYTES = 32;

export function issueRegistrationAccessToken() {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  return { rawToken, tokenHash: hashRegistrationAccessToken(rawToken) };
}

export function hashRegistrationAccessToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

export function isValidRegistrationAccessToken(token, expectedHash) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return false;
  const actual = Buffer.from(hashRegistrationAccessToken(token), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
