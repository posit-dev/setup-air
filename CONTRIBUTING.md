# Development dependencies

Install yourself:

-   npm - For node management. `brew install npm`.

Installed by `npm install`:

-   biome - For linting and formatting. We also recommend installing the Biome extension through the VS Code marketplace so you can format and lint on every save.

-   tsc and ncc - For building `dist/air-action/index.js`.

# Workflow

-   Make changes to `src/`

-   Run `npm run all` to update `dist/air-action/index.js`

-   If appropriate, add tests to `.github/workflows/test.yml`

# Dependabot

Dependabot PRs will update Typescript dependencies. This typically works well, but make sure to pull and run `npm run all` afterwards to update the `dist/air-action/index.js`.

# Release

TODO

-   Talk about sliding releases

    -   Does `uses: posit-dev/air-action@v1` mean the user gets the v1 tag or the v1.x tag? If the v1 tag, does that mean we re-release v1 every time we have a patch update?

-   Talk about `v` as a prefix for versions

-   Maybe we add a `release.yml` helper workflow?
