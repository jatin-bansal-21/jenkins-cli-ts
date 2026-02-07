import type {
  BuildPreContext,
  BuildPostContext,
  EventId,
  FlowHandlerRegistry,
  ListInteractiveContext,
  StatusPostContext,
} from "./types";
import { CliError, printError, printHint } from "../cli";
import {
  loadCachedBranchHistory,
  loadCachedBranches,
  removeCachedBranch,
} from "../branches";
import { getJobDisplayName, resolveJobCandidates } from "../jobs";

const SEARCH_ALL_JOBS_VALUE = "__jenkins_cli_search_all__";
const BRANCH_CUSTOM_VALUE = "__jenkins_cli_custom_branch__";
const BRANCH_REMOVE_VALUE = "__jenkins_cli_remove_branch__";

function resolveSelectEvent(input: string): EventId {
  return `select:${input}`;
}

export const listFlowHandlers: FlowHandlerRegistry<ListInteractiveContext> = {
  "list.selectJob": ({ context, input }) => {
    const value = String(input);
    if (value === "__jenkins_cli_search_again__") {
      return "select:search_again";
    }
    if (value === "__jenkins_cli_exit__") {
      return "select:exit";
    }
    const selectedJob = context.jobs.find((job) => job.url === value);
    if (!selectedJob) {
      return "select:search_again";
    }
    context.selectedJob = selectedJob;
    return "select:job";
  },
  "list.selectAction": ({ context, input }) => {
    const value = String(input);
    if (value === "done") {
      return "done";
    }
    context.selectedAction = value;
    return resolveSelectEvent(value);
  },
  "list.runAction": async ({ context }) => {
    if (!context.selectedJob || !context.selectedAction) {
      return "action_error";
    }
    return await context.performAction(
      context.selectedAction,
      context.selectedJob,
    );
  },
};

export const buildFlowHandlers: FlowHandlerRegistry<BuildPostContext> = {
  "build.selectAction": ({ context, input }) => {
    const value = String(input);
    if (value === "done") {
      return "done";
    }
    context.selectedAction = value;
    return resolveSelectEvent(value);
  },
  "build.runAction": async ({ context }) => {
    if (!context.selectedAction) {
      return "action_error";
    }
    return await context.performAction(context.selectedAction);
  },
  "build.afterMenu": ({ context }) =>
    context.returnToCaller ? "return_to_caller" : "ask_repeat",
  "build.afterRoot": ({ context }) =>
    context.returnToCaller ? "return_to_caller_root" : "ask_repeat",
  "build.repeatConfirm": ({ input }) => (input ? "confirm:yes" : "confirm:no"),
};

export const buildPreFlowHandlers: FlowHandlerRegistry<BuildPreContext> = {
  "buildPre.entry": ({ context }) =>
    context.recentJobs.length > 0 ? "show_recent" : "search_direct",
  "buildPre.selectRecentJob": ({ context, input }) => {
    const value = String(input);
    if (value === SEARCH_ALL_JOBS_VALUE) {
      return "select:search_all";
    }
    const recent = context.recentJobs.find((entry) => entry.url === value);
    if (!recent) {
      return "select:search_all";
    }
    const matchingJob = context.jobs.find((job) => job.url === recent.url);
    context.selectedJobUrl = recent.url;
    context.selectedJobLabel = matchingJob
      ? getJobDisplayName(matchingJob)
      : recent.label;
    context.searchQuery = "";
    context.searchCandidates = [];
    return "select:recent";
  },
  "buildPre.submitSearch": ({ context, input }) => {
    const query = String(input ?? "").trim();
    context.searchQuery = query;
    if (!query) {
      printError("Job name is required.");
      printHint("Type part of the job name or description to continue.");
      return "search:retry";
    }

    try {
      const candidates = resolveJobCandidates(query, context.jobs);
      if (candidates.length === 1 && candidates[0]) {
        context.selectedJobUrl = candidates[0].url;
        context.selectedJobLabel = getJobDisplayName(candidates[0]);
        context.searchCandidates = [];
        return "search:auto";
      }
      context.searchCandidates = candidates;
      return "search:candidates";
    } catch (error) {
      if (error instanceof CliError && shouldRetryJobSearch(error)) {
        printError(error.message);
        for (const hint of error.hints) {
          printHint(hint);
        }
        return "search:retry";
      }
      throw error;
    }
  },
  "buildPre.selectSearchCandidate": ({ context, input }) => {
    const value = String(input);
    const selected = context.searchCandidates.find((job) => job.url === value);
    if (!selected) {
      return "select:search_again";
    }
    context.selectedJobUrl = selected.url;
    context.selectedJobLabel = getJobDisplayName(selected);
    context.searchCandidates = [];
    return "select:job";
  },
  "buildPre.prepareBranch": async ({ context }) => {
    const branch = context.branch?.trim() ?? "";
    if (context.defaultBranch || branch) {
      context.branch = branch;
      return "branch:ready";
    }

    const jobUrl = context.selectedJobUrl?.trim() ?? "";
    if (!jobUrl) {
      return "branch:error";
    }

    const choices = dedupeCaseInsensitive(
      await loadCachedBranches({
        env: context.env,
        jobUrl,
      }),
    );
    const removableBranches = dedupeCaseInsensitive(
      await loadCachedBranchHistory({
        env: context.env,
        jobUrl,
      }),
    );

    context.branchChoices = choices;
    context.removableBranches = removableBranches;

    return choices.length > 0 ? "branch:select" : "branch:entry";
  },
  "buildPre.selectBranch": ({ context, input }) => {
    const value = String(input);
    if (value === BRANCH_REMOVE_VALUE && context.removableBranches.length > 0) {
      return "branch:remove";
    }
    if (value === BRANCH_CUSTOM_VALUE) {
      return "branch:entry";
    }
    const branch = value.trim();
    if (!branch) {
      return "branch:entry";
    }
    context.branch = branch;
    return "branch:selected";
  },
  "buildPre.selectBranchToRemove": ({ context, input }) => {
    const branch = String(input).trim();
    if (!branch) {
      return "remove:selected";
    }
    context.pendingBranchRemoval = branch;
    return "remove:selected";
  },
  "buildPre.removeBranch": async ({ context }) => {
    const jobUrl = context.selectedJobUrl?.trim() ?? "";
    const branch = context.pendingBranchRemoval?.trim() ?? "";
    context.pendingBranchRemoval = undefined;

    if (!jobUrl || !branch) {
      return "remove:done";
    }

    const removed = await removeCachedBranch({
      env: context.env,
      jobUrl,
      branch,
    });
    if (removed) {
      context.removableBranches = removeBranch(
        context.removableBranches,
        branch,
      );
      context.branchChoices = removeBranch(context.branchChoices, branch);
    }
    return "remove:done";
  },
  "buildPre.submitBranch": ({ context, input }) => {
    const branch = String(input ?? "").trim();
    if (!branch) {
      printError("Branch is required to trigger a build.");
      printHint("Enter a branch name (e.g. main).");
      return "branch:retry";
    }
    context.branch = branch;
    return "branch:selected";
  },
};

export const statusFlowHandlers: FlowHandlerRegistry<StatusPostContext> = {
  "status.selectAction": ({ context, input }) => {
    const value = String(input);
    if (value === "done") {
      return "done";
    }
    context.selectedAction = value;
    return resolveSelectEvent(value);
  },
  "status.runAction": async ({ context }) => {
    if (!context.selectedAction) {
      return "action_error";
    }
    return await context.performAction(context.selectedAction);
  },
  "status.repeatConfirm": ({ input }) => (input ? "confirm:yes" : "confirm:no"),
};

export const flowHandlerRegistry = {
  list_interactive: listFlowHandlers,
  build_pre: buildPreFlowHandlers,
  build_post: buildFlowHandlers,
  status_post: statusFlowHandlers,
};

function shouldRetryJobSearch(error: CliError): boolean {
  if (error.message === "Job name is required.") {
    return true;
  }
  return error.message.startsWith("No jobs match ");
}

function dedupeCaseInsensitive(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function removeBranch(entries: string[], target: string): string[] {
  const key = target.toLowerCase();
  return entries.filter((entry) => entry.toLowerCase() !== key);
}
