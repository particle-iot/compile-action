# Automatic Product Firmware Versioning

## Overview

The auto-versioning feature is designed to manage product firmware version numbers in an automated and consistent manner.

## Usage

Auto-versioning is disabled by default. To enable auto-versioning:

1. Set the `auto-version` input parameter to `true`.
2. Add `fetch-depth: 0` to the `actions/checkout` step. This will ensure that the entire git history is available to the action.
3. [optional] Set the `auto-version-macro-name` input parameter to the name of the macro that contains the product version number. The default value is `PRODUCT_VERSION`.

You may also want to update your GitHub Actions workflow to commit the updated version file to the repository.
This will ensure that the version number is updated in the repository.
See the example workflow below for more details.

## How It Works

The auto-versioning feature works by finding the product version macro and the latest version number in code in your `sources-folder`.

If the git revision of the `sources-folder` is newer than the git revision that set the product version, the version number will be incremented.

The auto-versioning feature does not commit the updated version file to the repository. You will need to commit the updated version file to the repository.

## Example Workflows

Three example workflows are provided below:

 1. Manual versioning: increment the version number manually (does not use automatic versioning)
 1. Semi-automated versioning: create a new release when you manually trigger the workflow
 1. Continuous versioning: create a new release every time the firmware code changes on the `main` branch

### Manual Versioning

This example does not use auto-versioning.

You need to manually update the version number and create a git tag that matches the version number.

```yaml
name: Compile and Release

# This workflow runs on git tags
# It will only run when a tag is pushed to the repository that matches the pattern "v*"
on:
  push:
    tags:
      - 'v*'

jobs:
  compile-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@v1
        with:
          particle-platform-name: 'boron'
          device-os-version: 'latest-lts'
          sources-folder: 'product-firmware-src'

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          path: ${{ steps.compile.outputs.artifact-path }}

      - name: Create GitHub release
        uses: ncipollo/release-action@v1
        with:
          artifacts: ${{ steps.compile.outputs.artifact-path }}
          generateReleaseNotes: 'true'
          name: "Firmware ${{ steps.compile.outputs.firmware-version }}"
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Semi-automated Versioning

Manually triggering this workflow will:

1. compile the firmware
1. increment the version number if the firmware code has changed since the last version
1. _if the version number was incremented, the workflow continues, otherwise it skips the remaining steps_
1. commit the updated version file to the repository
1. push the changes to the repository
1. create a tag for the release
1. upload the firmware binary as an artifact to the GitHub

This approach lets you accumulate changes in the repository and then trigger a release when you are ready.

`Release` refers to a GitHub release, not a firmware release or OTA update. This example does not trigger OTA updates.


```yaml
name: Compile and Release

# This workflow runs when we manually trigger it.
# Trigger it by going to the Actions tab in your repository and clicking the "Run workflow" button.
on:
  workflow_dispatch:

jobs:
  compile-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@v1
        with:
          particle-platform-name: 'boron'
          device-os-version: 'latest-lts'
          sources-folder: 'product-firmware-src'
          auto-version: true

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          path: ${{ steps.compile.outputs.artifact-path }}

      - name: Commit updated version file
        if: steps.compile.outputs.firmware-version-updated == 'true'
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git commit -m "Update firmware version" -a

      # When a GitHub Action pushes commits or tags, it does not trigger a new GitHub Action job
      - name: Push changes
        if: steps.compile.outputs.firmware-version-updated == 'true'
        uses: ad-m/github-push-action@v0.6.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ github.ref }}

      - name: Create GitHub release
        if: steps.compile.outputs.firmware-version-updated == 'true'
        uses: ncipollo/release-action@v1
        with:
          artifacts: ${{ steps.compile.outputs.artifact-path }}
          generateReleaseNotes: 'true'
          name: "Firmware ${{ steps.compile.outputs.firmware-version }}"
          tag: "v${{ steps.compile.outputs.firmware-version }}"
          commit: ${{ github.sha }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Continuous Versioning

This example workflow runs on every push to the `main` branch in the specified paths.

Every merged pull request or commit pushed to `main` will trigger a new release.

```yaml
name: Compile and Release

# This workflow runs on every push to the main branch in the specified paths.
on:
  push:
    branches:
      - main
    paths:
      - product-firmware-src/**
      - .github/**

jobs:
  compile-release:
    # Same as the semi-automated example above
```
