import { describe, expect, it } from "@jest/globals";
import { redactHealthText } from "../redact.js";

describe("health redaction", () => {
  it("removes authorization values, JWTs, URL tokens and long opaque values", () => {
    const text =
      "Bearer secret123 authorization: raw x-api-key=raw2 https://example.invalid/?access_token=urlsecret&token=another&key=third eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = redactHealthText(text, 1000);
    for (const secret of [
      "secret123",
      "raw2",
      "urlsecret",
      "another",
      "third",
      "signature",
    ]) {
      expect(result).not.toContain(secret);
    }
    expect(result).toContain("[redacted]");
  });

  it("truncates summaries", () => {
    expect(redactHealthText("abcdef", 3)).toBe("abc");
  });
});
