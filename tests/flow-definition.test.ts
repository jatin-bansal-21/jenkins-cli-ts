import { describe, expect, test } from "bun:test";
import { flows } from "../src/flows/definition";
import { validateFlowDefinition } from "../src/flows/validate";

describe("flow definitions", () => {
  test("all flow definitions pass validation", () => {
    expect(() => validateFlowDefinition(flows.listInteractive)).not.toThrow();
    expect(() => validateFlowDefinition(flows.buildPost)).not.toThrow();
    expect(() => validateFlowDefinition(flows.buildPre)).not.toThrow();
    expect(() => validateFlowDefinition(flows.statusPost)).not.toThrow();
  });

  test("validator rejects transitions to unknown states", () => {
    expect(() =>
      validateFlowDefinition({
        id: "listInteractive",
        initialState: "start",
        states: {
          start: {
            transitions: {
              next: "missing_state",
            },
          },
        },
      }),
    ).toThrow();
  });
});
