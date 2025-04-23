import * as core from "@actions/core";

export const INPUT_ARGS = core.getInput("args");
export const INPUT_VERSION = core.getInput("version");
export const INPUT_GITHUB_TOKEN = core.getInput("github-token");
