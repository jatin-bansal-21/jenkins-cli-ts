import type { JenkinsJob } from "../types/jenkins";

export type FlowId = "list_interactive" | "build_post" | "status_post";

export type StateId = string;

export type EventId = string;

export type TerminalState =
  | "exit_command"
  | "return_to_caller"
  | "return_to_caller_root"
  | "repeat"
  | "root"
  | "complete";

export type FlowPromptValue = string | boolean;

export type PromptOption = {
  value: string;
  label: string;
};

export type PromptSpec<Ctx> =
  | {
      kind: "select";
      message: string | ((context: Ctx) => string);
      options: PromptOption[] | ((context: Ctx) => PromptOption[]);
    }
  | {
      kind: "confirm";
      message: string | ((context: Ctx) => string);
      initialValue?: boolean | ((context: Ctx) => boolean);
    }
  | {
      kind: "text";
      message: string | ((context: Ctx) => string);
      placeholder?: string | ((context: Ctx) => string);
      initialValue?: string | ((context: Ctx) => string);
    };

export type StateDefinition<Ctx> = {
  id: StateId;
  root?: boolean;
  prompt?: PromptSpec<Ctx>;
  onEnter?: string;
  onSelect?: string;
  transitions: Record<string, StateId | TerminalState>;
};

export type FlowDefinition<Ctx> = {
  id: FlowId;
  initialState: StateId;
  states: Record<StateId, StateDefinition<Ctx>>;
};

export type FlowHandler<Ctx> = (options: {
  context: Ctx;
  input?: FlowPromptValue;
}) => Promise<EventId> | EventId;

export type FlowHandlerRegistry<Ctx> = Record<string, FlowHandler<Ctx>>;

export type PromptAdapter = {
  select: (options: {
    message: string;
    options: PromptOption[];
  }) => Promise<unknown>;
  confirm: (options: {
    message: string;
    initialValue?: boolean;
  }) => Promise<unknown>;
  text: (options: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
  }) => Promise<unknown>;
  isCancel: (value: unknown) => boolean;
};

export type FlowRunResult<Ctx> = {
  terminal: TerminalState;
  stateId: StateId;
  context: Ctx;
};

export type ActionEffectResult =
  | "action_ok"
  | "watch_cancelled"
  | "action_error"
  | "root"
  | "exit";

export type ListInteractiveContext = {
  jobs: JenkinsJob[];
  selectedJob?: JenkinsJob;
  selectedAction?: string;
  performAction: (
    action: string,
    selectedJob: JenkinsJob,
  ) => Promise<ActionEffectResult>;
};

export type BuildPostContext = {
  jobLabel: string;
  returnToCaller: boolean;
  selectedAction?: string;
  performAction: (action: string) => Promise<ActionEffectResult>;
};

export type StatusPostContext = {
  targetLabel: string;
  selectedAction?: string;
  performAction: (action: string) => Promise<ActionEffectResult>;
};
