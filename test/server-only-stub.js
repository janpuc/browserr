// Vitest aliases the `server-only` import marker to this no-op so server modules
// (which start with `import "server-only"`) can be unit-tested under Node.
export {};
