import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("cli default command", () => {
  test("defaults to list flow when no command is provided", () => {
    const tempHome = mkdtempSync(join(tmpdir(), "jenkins-cli-home-"));

    try {
      const result = Bun.spawnSync({
        cmd: ["bun", "run", "src/index.ts", "--non-interactive"],
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOME: tempHome,
          JENKINS_URL: "https://jenkins.example.com",
          JENKINS_USER: "ci-user",
          JENKINS_API_TOKEN: "ci-token",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      const output =
        new TextDecoder().decode(result.stdout) +
        new TextDecoder().decode(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(output).toContain("Job cache is missing.");
      expect(output).not.toContain("Missing command. Use --help to see usage.");
    } finally {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
