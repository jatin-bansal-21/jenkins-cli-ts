# Prompt System (How Prompts Are Built)

This document explains how interactive prompts are assembled and executed in
`jenkins-cli`.

## 1) Prompt architecture

Prompt behavior is split into 3 layers:

1. `FlowDefinition` (`src/flows/definition.ts`)
   - Declares states, prompt types, and transitions.
   - Defines what the user sees (`message`, `options`, placeholders, defaults).
2. Handlers (`src/flows/handlers.ts`)
   - Maps prompt input to semantic events (for example `select:job`).
   - Updates flow context (selected job, selected action, branch, etc.).
3. Runner (`src/flows/runner.ts`)
   - Executes state machine loop.
   - Renders prompts via a prompt adapter and resolves next transition.

At runtime, commands call `runFlow(...)` and pass:

- `definition`: the flow map (`buildPre`, `buildPost`, `listInteractive`,
  `statusPost`)
- `handlers`: event resolver callbacks for each flow
- `prompts`: concrete prompt functions (`select`, `confirm`, `text`, `isCancel`)
- `context`: mutable flow state

## 2) Prompt types

Prompt kinds are defined in `src/flows/types.ts`:

- `select`: choose from options
- `confirm`: yes/no
- `text`: free input

Each prompt field can be static or context-driven:

- Static: `message: "Branch name"`
- Dynamic: `message: (context) => \`Action for ${context.targetLabel}\``

## 3) How a prompt becomes a transition

For each state in `runFlow(...)`:

1. Resolve prompt config from context.
2. Execute adapter method (`select`/`confirm`/`text`).
3. Convert result to event:
   - Cancel -> `esc`
   - Confirm -> `confirm:yes` / `confirm:no`
   - Select -> `select:<value>`
   - Text -> handler event (for example `search:candidates`)
4. Look up transition target in the state's `transitions`.
5. Continue until a terminal state (`exit_command`, `repeat`, etc.).

## 4) Dependencies and their uses

### External package dependencies

- `@clack/prompts` (`package.json`)
  - Actual terminal UI prompt implementation (`select`, `confirm`, `text`,
    `multiselect`, `spinner`, `isCancel`).
  - Used directly in prompt-driven commands like:
    - `src/commands/build.ts`
    - `src/commands/status.ts`
    - `src/commands/list-deps.ts`
    - `src/commands/cancel.ts`
    - `src/commands/login.ts`
- `yargs` (`package.json`)
  - CLI argument parsing and command routing.
  - Indirectly affects prompts by deciding interactive vs non-interactive paths.

### Internal prompt dependencies

- `src/flows/types.ts`
  - Prompt and flow type contracts.
- `src/flows/definition.ts`
  - Declarative state machine + prompt spec per command flow.
- `src/flows/handlers.ts`
  - Input-to-event mapping and context updates.
- `src/flows/runner.ts`
  - Generic flow execution engine.
- `src/flows/validate.ts`
  - Validates flow definitions before first run.
- `src/commands/list-deps.ts`
  - Adapter surface used by `list` for prompts and delegated actions.

## 5) Which flows own which prompts

- `listInteractive`
  - Job picker + action menu for `list`.
- `buildPre`
  - Job selection/search + branch selection/entry before triggering build.
- `buildPost`
  - Post-build actions (`watch`, `logs`, `cancel`, `rerun`, `done`).
- `statusPost`
  - Post-status follow-up actions and repeat confirmation.

## 6) Non-interactive mode behavior

When `--non-interactive` is enabled, command code bypasses prompt flows and
fails fast if required input is missing.

Examples:

- `runBuild` uses `runBuildOnce(...)` without `runFlow(...)`
- `runStatus` uses `runStatusOnce(...)` without post-action prompt loops
