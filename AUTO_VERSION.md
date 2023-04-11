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

## Example Workflow

This example workflow runs on every push to the `main` branch in the specified paths. It:

1. compiles the firmware
1. increments the version number if the firmware code has changed since the last version
1. _if the version number was incremented, the workflow continues, otherwise it skips the remaining steps_
1. commits the updated version file to the repository
1. pushes the changes to the repository
1. creates a tag for the release
1. uploads the firmware binary as an artifact to the GitHub

`Release` refers to a GitHub release, not a firmware release or OTA update. This example does not trigger OTA updates.

```yaml
name: Tag and Release Firmware

on:
  push:
    branches:
      - main
    paths:
      - product-firmware-src/**
      - .github/**

jobs:
  compile:
    runs-on: ubuntu-latest
    outputs:
      firmware-version: ${{ steps.compile.outputs.firmware-version }}
      firmware-version-updated: ${{ steps.compile.outputs.firmware-version-updated }}
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

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: firmware
          path: ${{ steps.compile.outputs.artifact-path }}

  create-release:
    needs: compile
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          path: output

      - name: Check if tag exists
        id: check
        run: |
          git fetch --tags
          tag="v${{ needs.compile.outputs.firmware-version }}"
          tag_exists=$(git tag -l "$tag")
          if [ -z "$tag_exists" ]; then
            echo "Tag '$tag' does not exist. The pipeline will continue and create a new release."
            echo "exists=false" >> $GITHUB_OUTPUT
          else
            echo "Tag '$tag' already exists. The pipeline will stop."
            echo "exists=true" >> $GITHUB_OUTPUT
          fi

      - name: Set tag and release variables
        if: steps.check.outputs.exists == 'false'
        id: set-vars
        run: |
          echo "artifacts=$(find ./output -type f -name "*.bin" | paste -sd, -)" >> $GITHUB_OUTPUT
          echo "tag=v${{ needs.compile.outputs.firmware-version }}" >> $GITHUB_OUTPUT
          echo "release-name=Firmware v${{ needs.compile.outputs.firmware-version }}" >> $GITHUB_OUTPUT

      - name: Create and push tag
        if: steps.check.outputs.exists == 'false'
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git tag ${{ steps.set-vars.outputs.tag }}
          git push --tags

      - name: Create GitHub release and upload artifact
        if: steps.check.outputs.exists == 'false'
        uses: ncipollo/release-action@v1
        with:
          artifacts: ${{ steps.set-vars.outputs.artifacts }}
          generateReleaseNotes: 'true'
          name: ${{ steps.set-vars.outputs.release-name }}
          tag: ${{ steps.set-vars.outputs.tag }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

