#!/usr/bin/env node

/**
 * Phase 6 Team 2: Audit Log Coverage Check
 *
 * Scans all API route files for POST/PATCH/PUT/DELETE handlers
 * and verifies each has an audit logging call.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const API_DIR = join(process.cwd(), "src/app/api");
const AUDIT_PATTERN = /\b(logAudit|logCreate|logUpdate|logDelete|logStatusChange)\s*\(/;

// Routes that are read-only or don't need audit logging
const EXCLUDED_ROUTES = [
  "auth/[...nextauth]",       // Auth handler (NextAuth internal)
  "me",                        // User profile read
  "search/unified",            // Read-only search
  "documents/pending",         // Read-only pending list
  "documents/search",          // Read-only search
  "progress/summary",          // Read-only summary
  "progress/comparison",       // Read-only comparison
  "progress/weather",          // Read-only weather
  "dashboard/summary",         // Read-only dashboard
  "integrations/wis/records",  // Read-only WIS records
  "integrations/wis/logs",     // Read-only WIS logs
  "system/support/faq",        // Read-only FAQ
  "system/external-links",     // Read-only links
  "notifications",             // Read-only notifications
  "resource/workforce/summary", // Read-only summary
  "resource/material-inspections/ledger", // Read-only ledger
  "safety/accident-free-status", // Read-only status
  "safety/new-workers",        // Read-only
  "safety/laws",               // Read-only
];

function findRouteFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

function extractMutationHandlers(content) {
  const handlers = [];
  const methodPattern = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\s*\(/g;
  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    handlers.push({ method: match[1], index: match.index });
  }
  return handlers;
}

function hasAuditCall(content, handlerIndex, nextHandlerIndex) {
  const handlerBody = content.slice(handlerIndex, nextHandlerIndex || content.length);
  return AUDIT_PATTERN.test(handlerBody);
}

function isExcluded(routePath) {
  const rel = relative(API_DIR, routePath).replace(/\/route\.ts$/, "").replace(/\\/g, "/");
  return EXCLUDED_ROUTES.some((excluded) => rel === excluded);
}

// Main
const routeFiles = findRouteFiles(API_DIR);
let totalHandlers = 0;
let coveredHandlers = 0;
const missing = [];

for (const filePath of routeFiles) {
  if (isExcluded(filePath)) continue;

  const content = readFileSync(filePath, "utf-8");
  const handlers = extractMutationHandlers(content);

  if (handlers.length === 0) continue;

  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i];
    const nextIndex = i + 1 < handlers.length ? handlers[i + 1].index : undefined;
    totalHandlers++;

    if (hasAuditCall(content, handler.index, nextIndex)) {
      coveredHandlers++;
    } else {
      const rel = relative(API_DIR, filePath);
      missing.push(`  ${rel} → ${handler.method}`);
    }
  }
}

const coverage = totalHandlers > 0 ? ((coveredHandlers / totalHandlers) * 100).toFixed(1) : "0.0";

console.log("=== Phase 6 Team 2: Audit Log Coverage ===\n");
console.log(`Total mutation handlers: ${totalHandlers}`);
console.log(`Covered with audit log:  ${coveredHandlers}`);
console.log(`Coverage:                ${coverage}%\n`);

if (missing.length > 0) {
  console.log(`Missing audit logging (${missing.length}):`);
  for (const entry of missing) {
    console.log(entry);
  }
  console.log("");
  process.exit(1);
} else {
  console.log("All mutation handlers have audit logging. ✓");
  process.exit(0);
}
