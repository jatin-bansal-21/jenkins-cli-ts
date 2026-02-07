import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { EnvConfig } from "../src/env";
import type { JenkinsClient } from "../src/jenkins/client";
import { runWait, waitForBuild } from "../src/commands/wait";

function createClient(stubs: Partial<JenkinsClient>): JenkinsClient {
  return stubs as JenkinsClient;
}

describe("wait command", () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    mock.clearAllMocks();
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    mock.restore();
  });

  test("waitForBuild returns immediately when latest build is already complete", async () => {
    const getJobStatus = mock(async () => ({
      lastBuildNumber: 42,
      lastBuildUrl: "https://jenkins.example.com/job/api/42/",
      result: "SUCCESS",
      building: false,
      lastBuildTimestamp: 1700000000000,
      lastBuildDurationMs: 25_000,
    }));
    const getBuildStatus = mock(async () => {
      throw new Error("should not fetch build status for completed build");
    });

    const result = await waitForBuild({
      client: createClient({
        getJobStatus,
        getBuildStatus,
        getQueueBuild: mock(async () => null),
      }),
      jobUrl: "https://jenkins.example.com/job/api/",
      jobLabel: "api",
      intervalMs: 1,
      nonInteractive: true,
    });

    expect(result).toMatchObject({
      result: "SUCCESS",
      buildNumber: 42,
      buildUrl: "https://jenkins.example.com/job/api/42/",
    });
    expect(getJobStatus).toHaveBeenCalledTimes(1);
    expect(getBuildStatus).toHaveBeenCalledTimes(0);
  });

  test("waitForBuild falls back from queue lookup to job/build status", async () => {
    const getQueueBuild = mock(async () => null);
    const getJobStatus = mock(async () => ({
      lastBuildNumber: 7,
      lastBuildUrl: "https://jenkins.example.com/job/api/7/",
      result: "SUCCESS",
      building: false,
      lastBuildTimestamp: 1700000000000,
      lastBuildDurationMs: 10_000,
    }));
    const getBuildStatus = mock(async () => ({
      buildNumber: 7,
      buildUrl: "https://jenkins.example.com/job/api/7/",
      result: "SUCCESS",
      building: false,
      timestampMs: 1700000000000,
      durationMs: 10_000,
    }));

    const result = await waitForBuild({
      client: createClient({
        getQueueBuild,
        getJobStatus,
        getBuildStatus,
      }),
      jobUrl: "https://jenkins.example.com/job/api/",
      queueUrl: "https://jenkins.example.com/queue/item/123/",
      jobLabel: "api",
      intervalMs: 1,
      nonInteractive: true,
    });

    expect(result).toMatchObject({
      result: "SUCCESS",
      buildNumber: 7,
      buildUrl: "https://jenkins.example.com/job/api/7/",
    });
    expect(getQueueBuild).toHaveBeenCalledTimes(1);
    expect(getJobStatus).toHaveBeenCalledTimes(1);
    expect(getBuildStatus).toHaveBeenCalledTimes(1);
  });

  test("runWait returns non-success result when build fails", async () => {
    const getBuildStatus = mock(async () => ({
      buildNumber: 9,
      buildUrl: "https://jenkins.example.com/job/api/9/",
      result: "FAILURE",
      building: false,
      timestampMs: 1700000000000,
      durationMs: 5_000,
    }));

    const result = await runWait({
      client: createClient({
        getBuildStatus,
      }),
      env: {} as EnvConfig,
      buildUrl: "https://jenkins.example.com/job/api/9/",
      nonInteractive: true,
      suppressExitCode: true,
    });

    expect(result).toMatchObject({
      result: "FAILURE",
      buildNumber: 9,
      buildUrl: "https://jenkins.example.com/job/api/9/",
    });
    expect(process.exitCode).toBe(0);
    expect(getBuildStatus).toHaveBeenCalledTimes(1);
  });
});
