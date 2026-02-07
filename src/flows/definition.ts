import type {
  BuildPreContext,
  BuildPostContext,
  FlowDefinition,
  ListInteractiveContext,
  StatusPostContext,
} from "./types";

const SEARCH_AGAIN_VALUE = "__jenkins_cli_search_again__";
const EXIT_VALUE = "__jenkins_cli_exit__";
const SEARCH_ALL_JOBS_VALUE = "__jenkins_cli_search_all__";
const BRANCH_CUSTOM_VALUE = "__jenkins_cli_custom_branch__";
const BRANCH_REMOVE_VALUE = "__jenkins_cli_remove_branch__";

export const listInteractiveFlow: FlowDefinition<ListInteractiveContext> = {
  id: "list_interactive",
  initialState: "select_job",
  states: {
    select_job: {
      id: "select_job",
      root: true,
      prompt: {
        kind: "select",
        message: "Select a job to operate on",
        options: (context) => [
          ...context.jobs.map((job) => ({
            value: job.url,
            label: job.fullName || job.name,
          })),
          { value: SEARCH_AGAIN_VALUE, label: "Search again" },
          { value: EXIT_VALUE, label: "Exit" },
        ],
      },
      onSelect: "list.selectJob",
      transitions: {
        esc: "root",
        "select:search_again": "root",
        "select:exit": "exit_command",
        "select:job": "action_menu",
      },
    },
    action_menu: {
      id: "action_menu",
      prompt: {
        kind: "select",
        message: (context) =>
          `Action for ${context.selectedJob?.fullName || context.selectedJob?.name || "job"}`,
        options: [
          { value: "build", label: "Build" },
          { value: "status", label: "Status" },
          { value: "watch", label: "Watch" },
          { value: "logs", label: "Logs" },
          { value: "cancel", label: "Cancel" },
          { value: "rerun", label: "Rerun last failed" },
          { value: "search", label: "Back to search" },
          { value: "exit", label: "Exit" },
        ],
      },
      onSelect: "list.selectAction",
      transitions: {
        esc: "select_job",
        "select:search": "root",
        "select:exit": "exit_command",
        "select:build": "run_action",
        "select:status": "run_action",
        "select:watch": "run_action",
        "select:logs": "run_action",
        "select:cancel": "run_action",
        "select:rerun": "run_action",
      },
    },
    run_action: {
      id: "run_action",
      onEnter: "list.runAction",
      transitions: {
        action_ok: "action_menu",
        watch_cancelled: "root",
        action_error: "root",
        root: "root",
        exit: "exit_command",
      },
    },
  },
};

export const buildPreFlow: FlowDefinition<BuildPreContext> = {
  id: "build_pre",
  initialState: "entry",
  states: {
    entry: {
      id: "entry",
      onEnter: "buildPre.entry",
      transitions: {
        show_recent: "recent_menu",
        search_direct: "search_direct",
      },
    },
    recent_menu: {
      id: "recent_menu",
      root: true,
      prompt: {
        kind: "select",
        message: "Recent jobs",
        options: (context) => [
          { value: SEARCH_ALL_JOBS_VALUE, label: "Search all jobs" },
          ...context.recentJobs.map((job) => ({
            value: job.url,
            label: job.label,
          })),
        ],
      },
      onSelect: "buildPre.selectRecentJob",
      transitions: {
        esc: "exit_command",
        "select:search_all": "search_from_recent",
        "select:recent": "prepare_branch",
      },
    },
    search_from_recent: {
      id: "search_from_recent",
      prompt: {
        kind: "text",
        message: "Job name or description",
        placeholder: "e.g. api prod deploy",
        initialValue: (context) => context.searchQuery,
      },
      onSelect: "buildPre.submitSearch",
      transitions: {
        esc: "recent_menu",
        "search:retry": "search_from_recent",
        "search:candidates": "results_from_recent",
        "search:auto": "prepare_branch",
      },
    },
    search_direct: {
      id: "search_direct",
      root: true,
      prompt: {
        kind: "text",
        message: "Job name or description",
        placeholder: "e.g. api prod deploy",
        initialValue: (context) => context.searchQuery,
      },
      onSelect: "buildPre.submitSearch",
      transitions: {
        esc: "exit_command",
        "search:retry": "search_direct",
        "search:candidates": "results_direct",
        "search:auto": "prepare_branch",
      },
    },
    results_from_recent: {
      id: "results_from_recent",
      prompt: {
        kind: "select",
        message: "Select a job (press Esc to search again)",
        options: (context) =>
          context.searchCandidates.map((job) => ({
            value: job.url,
            label: job.fullName || job.name,
          })),
      },
      onSelect: "buildPre.selectSearchCandidate",
      transitions: {
        esc: "search_from_recent",
        "select:search_again": "search_from_recent",
        "select:job": "prepare_branch",
      },
    },
    results_direct: {
      id: "results_direct",
      prompt: {
        kind: "select",
        message: "Select a job (press Esc to search again)",
        options: (context) =>
          context.searchCandidates.map((job) => ({
            value: job.url,
            label: job.fullName || job.name,
          })),
      },
      onSelect: "buildPre.selectSearchCandidate",
      transitions: {
        esc: "search_direct",
        "select:search_again": "search_direct",
        "select:job": "prepare_branch",
      },
    },
    prepare_branch: {
      id: "prepare_branch",
      onEnter: "buildPre.prepareBranch",
      transitions: {
        "branch:ready": "complete",
        "branch:select": "branch_select",
        "branch:entry": "branch_entry",
        "branch:error": "entry",
      },
    },
    branch_select: {
      id: "branch_select",
      prompt: {
        kind: "select",
        message: "Branch name (press Esc to choose another job)",
        options: (context) => [
          ...(context.removableBranches.length > 0
            ? [{ value: BRANCH_REMOVE_VALUE, label: "Remove cached branch" }]
            : []),
          ...context.branchChoices.map((branch) => ({
            value: branch,
            label: branch,
          })),
          { value: BRANCH_CUSTOM_VALUE, label: "Type a different branch" },
        ],
      },
      onSelect: "buildPre.selectBranch",
      transitions: {
        esc: "entry",
        "branch:selected": "complete",
        "branch:entry": "branch_entry",
        "branch:remove": "branch_remove",
      },
    },
    branch_remove: {
      id: "branch_remove",
      prompt: {
        kind: "select",
        message: "Remove cached branch",
        options: (context) =>
          context.removableBranches.map((branch) => ({
            value: branch,
            label: branch,
          })),
      },
      onSelect: "buildPre.selectBranchToRemove",
      transitions: {
        esc: "branch_select",
        "remove:selected": "branch_remove_apply",
      },
    },
    branch_remove_apply: {
      id: "branch_remove_apply",
      onEnter: "buildPre.removeBranch",
      transitions: {
        "remove:done": "branch_select",
      },
    },
    branch_entry: {
      id: "branch_entry",
      prompt: {
        kind: "text",
        message: "Branch name",
        placeholder: "e.g. main",
      },
      onSelect: "buildPre.submitBranch",
      transitions: {
        esc: "branch_select",
        "branch:retry": "branch_entry",
        "branch:selected": "complete",
      },
    },
  },
};

export const buildPostFlow: FlowDefinition<BuildPostContext> = {
  id: "build_post",
  initialState: "action_menu",
  states: {
    action_menu: {
      id: "action_menu",
      prompt: {
        kind: "select",
        message: (context) => `Next action for ${context.jobLabel}`,
        options: [
          { value: "watch", label: "Watch" },
          { value: "logs", label: "Logs" },
          { value: "cancel", label: "Cancel" },
          { value: "rerun", label: "Rerun same inputs" },
          { value: "done", label: "Done" },
        ],
      },
      onSelect: "build.selectAction",
      transitions: {
        esc: "after_menu",
        done: "after_menu",
        "select:watch": "run_action",
        "select:logs": "run_action",
        "select:cancel": "run_action",
        "select:rerun": "run_action",
      },
    },
    run_action: {
      id: "run_action",
      onEnter: "build.runAction",
      transitions: {
        action_ok: "action_menu",
        watch_cancelled: "after_root",
        action_error: "after_root",
        root: "after_root",
        exit: "exit_command",
      },
    },
    after_menu: {
      id: "after_menu",
      onEnter: "build.afterMenu",
      transitions: {
        ask_repeat: "repeat_confirm",
        return_to_caller: "return_to_caller",
      },
    },
    after_root: {
      id: "after_root",
      onEnter: "build.afterRoot",
      transitions: {
        ask_repeat: "repeat_confirm",
        return_to_caller_root: "return_to_caller_root",
      },
    },
    repeat_confirm: {
      id: "repeat_confirm",
      root: true,
      prompt: {
        kind: "confirm",
        message: "Trigger another build?",
        initialValue: false,
      },
      onSelect: "build.repeatConfirm",
      transitions: {
        esc: "exit_command",
        "confirm:yes": "repeat",
        "confirm:no": "exit_command",
      },
    },
  },
};

export const statusPostFlow: FlowDefinition<StatusPostContext> = {
  id: "status_post",
  initialState: "action_menu",
  states: {
    action_menu: {
      id: "action_menu",
      prompt: {
        kind: "select",
        message: (context) => `Action for ${context.targetLabel}`,
        options: [
          { value: "watch", label: "Watch" },
          { value: "logs", label: "Logs" },
          { value: "cancel", label: "Cancel running/queued build" },
          { value: "rerun", label: "Rerun last failed build" },
          { value: "build", label: "Build now" },
          { value: "done", label: "Done" },
        ],
      },
      onSelect: "status.selectAction",
      transitions: {
        esc: "again_confirm",
        done: "again_confirm",
        "select:watch": "run_action",
        "select:logs": "run_action",
        "select:cancel": "run_action",
        "select:rerun": "run_action",
        "select:build": "run_action",
      },
    },
    run_action: {
      id: "run_action",
      onEnter: "status.runAction",
      transitions: {
        action_ok: "action_menu",
        watch_cancelled: "again_confirm",
        action_error: "again_confirm",
        root: "again_confirm",
        exit: "exit_command",
      },
    },
    again_confirm: {
      id: "again_confirm",
      root: true,
      prompt: {
        kind: "confirm",
        message: "Check another job?",
        initialValue: false,
      },
      onSelect: "status.repeatConfirm",
      transitions: {
        esc: "exit_command",
        "confirm:yes": "repeat",
        "confirm:no": "exit_command",
      },
    },
  },
};

export const flowDefinitions = {
  list_interactive: listInteractiveFlow,
  build_pre: buildPreFlow,
  build_post: buildPostFlow,
  status_post: statusPostFlow,
};
