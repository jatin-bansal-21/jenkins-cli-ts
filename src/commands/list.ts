/**
 * List command implementation.
 * Displays all cached Jenkins jobs with optional search filtering.
 */
import { CliError, printError, printHint, printOk } from "../cli";
import type { EnvConfig } from "../env";
import type { JenkinsClient } from "../jenkins/client";
import type { JenkinsJob } from "../types/jenkins";
import { MIN_SCORE } from "../config/fuzzy";
import { listDeps } from "./list-deps";
import { runFlow } from "../flows/runner";
import { flowDefinitions } from "../flows/definition";
import { listFlowHandlers } from "../flows/handlers";
import type {
  ActionEffectResult,
  ListInteractiveContext,
} from "../flows/types";

/** Options for the list command. */
type ListOptions = {
  client: JenkinsClient;
  env: EnvConfig;
  search?: string;
  refresh?: boolean;
  nonInteractive: boolean;
};

export async function runList(options: ListOptions): Promise<void> {
  const jobs = await listDeps.loadJobs({
    client: options.client,
    env: options.env,
    refresh: options.refresh,
    nonInteractive: options.nonInteractive,
    confirmRefresh: async (reason) => {
      const response = await listDeps.confirm({
        message: `${reason} Refresh now?`,
        initialValue: true,
      });
      if (listDeps.isCancel(response)) {
        throw new CliError("Operation cancelled.");
      }
      return response;
    },
  });

  const printJobs = (entries: JenkinsJob[], search: string): void => {
    const jobsToPrint = entries;

    if (search && jobsToPrint.length === 0) {
      printOk(`No jobs match "${search}".`);
      return;
    }

    for (const job of jobsToPrint) {
      console.log(`${listDeps.getJobDisplayName(job)}  ${job.url}`);
    }
  };

  const isExitToken = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized === "q" || normalized === "quit" || normalized === "exit";
  };

  if (options.nonInteractive) {
    const search = options.search?.trim() ?? "";
    printJobs(getFilteredJobs(jobs, search), search);
    return;
  }

  let pendingSearch = options.search?.trim() ?? "";
  while (true) {
    const search = await promptSearch(pendingSearch);
    pendingSearch = "";
    if (isExitToken(search)) {
      return;
    }

    const filteredJobs = getFilteredJobs(jobs, search);
    if (filteredJobs.length === 0) {
      printOk(`No jobs match "${search}".`);
      continue;
    }
    printJobs(filteredJobs, search);

    const listAction = await runListActionMenu({
      client: options.client,
      env: options.env,
      jobs: filteredJobs,
    });
    if (listAction === "exit") {
      return;
    }
  }
}

function getFilteredJobs(jobs: JenkinsJob[], search: string): JenkinsJob[] {
  if (!search) {
    return jobs
      .slice()
      .sort((a, b) =>
        listDeps
          .getJobDisplayName(a)
          .localeCompare(listDeps.getJobDisplayName(b)),
      );
  }
  return listDeps
    .rankJobs(search, jobs)
    .filter((match) => match.score >= MIN_SCORE)
    .map((match) => match.job);
}

async function promptSearch(initialSearch: string): Promise<string> {
  if (initialSearch) {
    return initialSearch;
  }
  const response = await listDeps.text({
    message: "Search jobs (optional, q to exit)",
    placeholder: "e.g. api prod",
  });
  if (listDeps.isCancel(response)) {
    throw new CliError("Operation cancelled.");
  }
  return String(response).trim();
}

async function runListActionMenu(options: {
  client: JenkinsClient;
  env: EnvConfig;
  jobs: JenkinsJob[];
}): Promise<"search" | "exit"> {
  const context: ListInteractiveContext = {
    jobs: options.jobs,
    performAction: async (action, selectedJob) => {
      if (action === "build") {
        return await runMenuAction(async () => {
          const result = await listDeps.runBuild({
            client: options.client,
            env: options.env,
            jobUrl: selectedJob.url,
            branchParam: options.env.branchParamDefault,
            nonInteractive: false,
            returnToCaller: true,
          });
          return result?.rootRequested ? "root" : "action_ok";
        });
      }
      if (action === "status") {
        return await runMenuAction(async () => {
          await listDeps.runStatus({
            client: options.client,
            env: options.env,
            jobUrl: selectedJob.url,
            nonInteractive: true,
          });
          return "action_ok";
        });
      }
      if (action === "watch") {
        return await runMenuAction(async () => {
          const result = await listDeps.runWait({
            client: options.client,
            env: options.env,
            jobUrl: selectedJob.url,
            nonInteractive: false,
            suppressExitCode: true,
          });
          if (!result) {
            return "action_error";
          }
          return result.cancelled ? "watch_cancelled" : "action_ok";
        });
      }
      if (action === "logs") {
        return await runMenuAction(async () => {
          await listDeps.runLogs({
            client: options.client,
            env: options.env,
            jobUrl: selectedJob.url,
            follow: true,
            nonInteractive: false,
          });
          return "action_ok";
        });
      }
      if (action === "cancel") {
        return await runMenuAction(async () => {
          await listDeps.runCancel({
            client: options.client,
            env: options.env,
            jobUrl: selectedJob.url,
            nonInteractive: false,
          });
          return "action_ok";
        });
      }
      if (action === "rerun") {
        return await runMenuAction(async () => {
          await listDeps.runRerun({
            client: options.client,
            env: options.env,
            jobUrl: selectedJob.url,
            nonInteractive: false,
          });
          return "action_ok";
        });
      }
      return "action_error";
    },
  };

  const result = await runFlow({
    definition: flowDefinitions.list_interactive,
    handlers: listFlowHandlers,
    prompts: {
      select: listDeps.select,
      confirm: listDeps.confirm,
      text: listDeps.text,
      isCancel: listDeps.isCancel,
    },
    context,
  });

  if (result.terminal === "exit_command") {
    return "exit";
  }
  return "search";
}

async function runMenuAction<T extends ActionEffectResult>(
  action: () => Promise<T>,
): Promise<T | "action_error"> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof CliError) {
      printError(error.message);
      for (const hint of error.hints) {
        printHint(hint);
      }
      return "action_error";
    }
    throw error;
  }
}
