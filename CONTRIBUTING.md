# Development dependencies

Installed by you:

-   npm - For node management. `brew install npm`.

Installed by `npm install`:

-   biome - For linting and formatting. We also recommend installing the Biome extension through the VS Code marketplace so you can format and lint on every save.

-   tsc and ncc - For building `dist/setup-air/index.js`.

# Workflow

-   Start a branch

-   Make changes to `src/`

-   Run `npm run all` to update `dist/setup-air/index.js`

-   If appropriate, add tests to `.github/workflows/test.yml`

-   Add a bullet to `CHANGELOG.md`

-   Open a PR

# Testing

We use a `test.yml` GitHub Workflow to do some basic testing. It lets us test across platforms, which is pretty nice.

# Dependabot

Dependabot PRs will update Typescript dependencies. This typically works well, but make sure to pull and run `npm run all` afterwards to update the `dist/setup-air/index.js`.

# Release

GitHub Action releases are managed through git tags and GitHub Releases. They are a bit strange, as you typically have:

-   A major release tag and GitHub Release that most people use (i.e. `v1` or `v2`)

-   Minor or patch release tags (with no breaking changes, i.e. `v1.2.3`)

When you release a new minor or patch release, you also update the major release tag to match the commit of the latest minor or patch release. You then also update the major release GitHub Release with the CHANGELOG latest bullets. A typical process looks like:

-   Update `CHANGELOG.md` from `Development version` to `vX.Y.Z` and add today's date. Go ahead and add a new `Development version` header as well.

-   Add a patch or minor release tag.

    ```
    git tag vX.Y.Z
    git push --tags -f
    ```

-   Update the major release tag.

    ```
    git tag vX -f
    git push --tags -f
    ```

-   Update the major release GitHub Release

    -   It should already be pointing at the sliding `vX` tag

    -   Copy over CHANGELOG bullets for this patch or minor release into the release notes

-   Update the SHAs in the `examples/` workflows

    -   Update the pinned `posit-dev/setup-air` SHA to the latest commit

    -   Update the pinned SHAs for other dependencies as you see fit