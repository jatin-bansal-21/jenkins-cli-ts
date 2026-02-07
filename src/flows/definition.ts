import type {
  BuildPostContext,
  FlowDefinition,
  ListInteractiveContext,
  StatusPostContext,
} from "./types";

const SEARCH_AGAIN_VALUE = "__jenkins_cli_search_again__";
const EXIT_VALUE = "__jenkins_cli_exit__";

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
  build_post: buildPostFlow,
  status_post: statusPostFlow,
};
