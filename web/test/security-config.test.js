import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("deployed authentication policy", () => {
  it("grants only the CSP capabilities used by persistent token storage", () => {
    const applicationSource = read("src/main.jsx");
    const deployment = JSON.parse(read("vercel.json"));
    const policy = deployment.headers[0].headers.find(
      ({ key }) => key === "Content-Security-Policy",
    ).value;

    expect(applicationSource).toContain('cacheLocation="localstorage"');
    expect(policy).not.toContain("worker-src");
    expect(policy).not.toContain("frame-src");
    expect(policy).not.toContain("blob:");
    expect(policy).toContain("https://tejasbhat.eu.auth0.com");
  });
});
