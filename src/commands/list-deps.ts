import { confirm, isCancel, select, text } from "@clack/prompts";
import { getJobDisplayName, loadJobs, rankJobs } from "../jobs";
import { runBuild } from "./build";
import { runCancel } from "./cancel";
import { runLogs } from "./logs";
import { runRerun } from "./rerun";
import { runStatus } from "./status";
import { runWait } from "./wait";

export const listDeps = {
  confirm,
  isCancel,
  select,
  text,
  getJobDisplayName,
  loadJobs,
  rankJobs,
  runBuild,
  runStatus,
  runWait,
  runLogs,
  runCancel,
  runRerun,
};
