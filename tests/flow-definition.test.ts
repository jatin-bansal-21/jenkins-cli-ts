import { describe, expect, test } from "bun:test";
import { flowDefinitions } from "../src/flows/definition";
import { validateFlowDefinition } from "../src/flows/validate";

describe("flow definitions", () => {
  test("all flow definitions pass validation", () => {
    expect(() =>
      validateFlowDefinition(flowDefinitions.list_interactive),
    ).not.toThrow();
    expect(() =>
      validateFlowDefinition(flowDefinitions.build_post),
    ).not.toThrow();
    expect(() =>
      validateFlowDefinition(flowDefinitions.status_post),
    ).not.toThrow();
  });

  test("validator rejects transitions to unknown states", () => {
    expect(() =>
      validateFlowDefinition({
        id: "list_interactive",
        initialState: "start",
        states: {
          start: {
            id: "start",
            transitions: {
              next: "missing_state",
            },
          },
        },
      }),
    ).toThrow();
  });
});
