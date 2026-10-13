const SECRET = '[redacted]';

export function redactHealthText(value: string, maxLength = 300): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, `Bearer ${SECRET}`)
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      SECRET,
    )
    .replace(/([?&](?:access_token|token|key)=)[^&#\s]+/gi, `$1${SECRET}`)
    .replace(/((?:x-api-key|authorization)\s*[:=]\s*)[^\s,;]+/gi, `$1${SECRET}`)
    .replace(/\b[A-Fa-f0-9]{40,}\b/g, SECRET)
    .replace(/\b[A-Za-z0-9+/]{60,}={0,2}\b/g, SECRET)
    .slice(0, maxLength);
}
