# air-action

A GitHub Action to run [Air](https://github.com/posit-dev/air).

## Usage

| Input | Description | Default |
|---------------|-------------------------------------------|---------------|
| `args` | The arguments to pass to the `air` command. See [configuring Air](https://posit-dev.github.io/air/configuration.html). If none are provided, `air` is installed and added to the `PATH` but not invoked. | None |
| `version` | The version of Air to install. See [Install specific versions](#install-specific-versions). | `latest` |
| `github-token` | The GitHub token to use for authentication. Generally not required. | `secrets.GITHUB_TOKEN` |

### Use `air format --check`

The most common way to use this action is to perform a `format --check` on each PR to ensure that the code within the PR is correctly formatted.

``` yaml
- uses: posit-dev/air-action@v1
  with:
    args: format . --check
```

### Use `air format`

``` yaml
- uses: posit-dev/air-action@v1
  with:
    args: format .
```

On a specific directory:

``` yaml
- uses: posit-dev/air-action@v1
  with:
    args: format ./directory
```

### Use to install Air

This action adds Air to the `PATH`, so you can use it in subsequent steps.

``` yaml
- uses: posit-dev/air-action@v1
- run: air format .
```

By default, no Air commands are performed in the `posit-dev/air-action` installation step unless `args` are provided.

### Install specific versions {#install-specific-versions}

By default this action installs the latest version of Air. You can also request a specific version, or a semver compatible range.

#### Install the latest version

``` yaml
- name: Install the latest version of Air
  uses: posit-dev/air-action@v1
  with:
    version: "latest"
```

#### Install a specific version

``` yaml
- name: Install a specific version of Air
  uses: posit-dev/air-action@v1
  with:
    version: "0.4.4"
```

#### Install a version by supplying a semver range

You can specify a [semver range](https://github.com/npm/node-semver?tab=readme-ov-file#ranges) to install the latest version that satisfies the range.

``` yaml
- name: Install a semver range of Air
  uses: posit-dev/air-action@v1
  with:
    version: ">=0.4.0"
```

``` yaml
- name: Pinning a minor version of Air
  uses: posit-dev/air-action@v1
  with:
    version: "0.4.x"
```

### GitHub authentication token

This action uses the GitHub API to fetch the Air release artifacts. To avoid hitting the GitHub API rate limit too quickly, an authentication token can be provided via the `github-token` input. By default, the `GITHUB_TOKEN` secret is used, which is automatically provided by GitHub Actions.

If the default [permissions for the GitHub token](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#permissions-for-the-github_token) are not sufficient, you can provide a custom GitHub token with the necessary permissions.

``` yaml
- name: Install the latest version of Air with a custom GitHub token
  uses: posit-dev/air-action@v1
  with:
    github-token: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
```

## Outputs

| Output        | Description                            |
|---------------|----------------------------------------|
| `air-version` | The version of Air that was installed. |

## Acknowledgments

This is a fork of the great [ruff-action](https://github.com/astral-sh/ruff-action).
