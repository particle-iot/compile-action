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

Auto-versioning should only run against your `main` branch.

## How It Works

The auto-versioning feature works by finding the product version macro and the latest version number in code in your `sources-folder`.

If the git revision of the `sources-folder` is newer than the git revision that set the product version, the version number will be incremented.

The auto-versioning feature does not commit the updated version file to the repository. You will need to commit the updated version file to the repository.

## Example Workflows

Three example workflows are provided below:

 1. Manual versioning: increment the version number manually (does not use automatic versioning)
 1. Semi-automated versioning: create a new release when you manually trigger the workflow
 1. Continuous versioning: create a new release every time the firmware code changes on the `main` branch

`Release` refers to a GitHub release, not a firmware release or OTA update. The examples do not trigger OTA updates.

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

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          path: |
            ${{ steps.compile.outputs.firmware-path }}
            ${{ steps.compile.outputs.target-path }}

      - name: Create archive of target directory
        run: |
          tar -czf debug-objects.tar.gz ${{ steps.compile.outputs.target-path }}

      - name: Create GitHub release
        uses: ncipollo/release-action@v1
        with:
          artifacts: ${{ steps.compile.outputs.firmware-path }},debug-objects.tar.gz
          generateReleaseNotes: 'true'
          name: "Firmware v${{ steps.compile.outputs.firmware-version }}"
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Semi-automated Versioning

This example automatically increments the product firmware version when you manually trigger the workflow.

This approach lets you accumulate changes in the repository and then trigger a release when you are ready.

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
          auto-version: true

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          path: |
            ${{ steps.compile.outputs.firmware-path }}
            ${{ steps.compile.outputs.target-path }}

      - name: Commit updated version file
        id: commit
        if: steps.compile.outputs.firmware-version-updated == 'true'
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git commit -m "Update firmware version" -a
          echo "updated-version-sha=$(git rev-parse HEAD)" >> $GITHUB_OUTPUT

      # When a GitHub Action pushes commits or tags, it does not trigger a new GitHub Action job
      - name: Push changes
        if: steps.compile.outputs.firmware-version-updated == 'true'
        uses: ad-m/github-push-action@v0.6.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ github.ref }}

      - name: Create archive of target directory
        if: steps.compile.outputs.firmware-version-updated == 'true'
        run: |
          tar -czf debug-objects.tar.gz ${{ steps.compile.outputs.target-path }}

      - name: Create GitHub release
        if: steps.compile.outputs.firmware-version-updated == 'true'
        uses: ncipollo/release-action@v1
        with:
          artifacts: ${{ steps.compile.outputs.firmware-path }},debug-objects.tar.gz
          generateReleaseNotes: 'true'
          name: "Firmware v${{ steps.compile.outputs.firmware-version }}"
          tag: "v${{ steps.compile.outputs.firmware-version }}"
          commit: ${{ steps.commit.outputs.updated-version-sha }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Continuous Versioning

This workflow automatically increments the product firmware version on every push to the `main` branch in the specified paths.

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


## Limitations

1. Limited Branch Awareness: The auto-versioning feature is designed to run against only the `main` branch. 
   It is not fully aware of branching and merging in git. It may not behave as expected with non-linear histories resulting from complex branching and merging

1. Manual Version Changes: If you manually increment the version macro while automatic versioning is enabled, the automatic versioning system may increment the version again.
   It is recommended that you disable automatic versioning if you are going to manually increment the version macro.

