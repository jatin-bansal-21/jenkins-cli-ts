import type {
  BuildPostContext,
  EventId,
  FlowHandlerRegistry,
  ListInteractiveContext,
  StatusPostContext,
} from "./types";

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
  build_post: buildFlowHandlers,
  status_post: statusFlowHandlers,
};
