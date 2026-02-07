import { describe, expect, test } from "bun:test";
import { flowDefinitions } from "../src/flows/definition";
import { buildFlowHandlers, listFlowHandlers } from "../src/flows/handlers";
import { runFlow } from "../src/flows/runner";
import type {
  BuildPostContext,
  ListInteractiveContext,
} from "../src/flows/types";

const CANCEL = Symbol("cancel");

function createPromptAdapter(responses: unknown[]) {
  let cursor = 0;
  return {
    select: async () => responses[cursor++],
    confirm: async () => responses[cursor++],
    text: async () => responses[cursor++],
    isCancel: (value: unknown) => value === CANCEL,
  };
}

describe("flow runner", () => {
  test("root esc exits command", async () => {
    const context: BuildPostContext = {
      jobLabel: "api-staging",
      returnToCaller: false,
      performAction: async () => "action_ok",
    };

    const result = await runFlow({
      definition: flowDefinitions.build_post,
      handlers: buildFlowHandlers,
      prompts: createPromptAdapter([CANCEL]),
      context,
      startStateId: "repeat_confirm",
    });

    expect(result.terminal).toBe("exit_command");
  });

  test("menu esc goes back one level before root handling", async () => {
    const context: BuildPostContext = {
      jobLabel: "api-staging",
      returnToCaller: false,
      performAction: async () => "action_ok",
    };

    const result = await runFlow({
      definition: flowDefinitions.build_post,
      handlers: buildFlowHandlers,
      prompts: createPromptAdapter([CANCEL, false]),
      context,
    });

    expect(result.terminal).toBe("exit_command");
  });

  test("watch cancellation routes to root", async () => {
    const context: ListInteractiveContext = {
      jobs: [{ name: "api", url: "https://jenkins.example.com/job/api/" }],
      performAction: async () => "watch_cancelled",
    };

    const result = await runFlow({
      definition: flowDefinitions.list_interactive,
      handlers: listFlowHandlers,
      prompts: createPromptAdapter([
        "https://jenkins.example.com/job/api/",
        "watch",
      ]),
      context,
    });

    expect(result.terminal).toBe("root");
  });

  test("action error routes to root", async () => {
    const context: ListInteractiveContext = {
      jobs: [{ name: "api", url: "https://jenkins.example.com/job/api/" }],
      performAction: async () => "action_error",
    };

    const result = await runFlow({
      definition: flowDefinitions.list_interactive,
      handlers: listFlowHandlers,
      prompts: createPromptAdapter([
        "https://jenkins.example.com/job/api/",
        "logs",
      ]),
      context,
    });

    expect(result.terminal).toBe("root");
  });

  test("explicit done and confirm yes returns repeat", async () => {
    const context: BuildPostContext = {
      jobLabel: "api-staging",
      returnToCaller: false,
      performAction: async () => "action_ok",
    };

    const result = await runFlow({
      definition: flowDefinitions.build_post,
      handlers: buildFlowHandlers,
      prompts: createPromptAdapter(["done", true]),
      context,
    });

    expect(result.terminal).toBe("repeat");
  });
});
