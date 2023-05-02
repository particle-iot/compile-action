# Particle Compile Action
[![Build and Test](https://github.com/particle-iot/compile-action/actions/workflows/test.yml/badge.svg)](https://github.com/particle-iot/compile-action/actions/workflows/test.yml)

A GitHub Action to compile Particle application firmware

> This project is currently under development with no stable v1 release yet. 
  Documentation refers to the `main` branch, but please be aware that stability guarantees are not provided at this stage.

## Usage

```yaml
- uses: particle-iot/compile-action@main
  with:
    # The platform name to target the compilation
    # Allowed values: core, photon, p1, electron, argon, boron, xenon, esomx, bsom, b5som, tracker, trackerm, p2, muon
    # Required: true
    particle-platform-name: ''
      
    # Path to directory with sources to compile
    # Required: false
    sources-folder: 'src'
      
    # Target Device OS firmware version
    # Allowed values:
    #   default:    the default Device OS version for the platform (LTS when available, otherwise latest)
    #   latest:     the most recent Device OS version for the platform
    #   latest-lts: the most recent LTS Device OS version for the platform
    #   <version>:  a specific Device OS version, e.g. 2.3.1
    #   ^<version>: a semver range, e.g. ^5.3.0
    # For production projects, you should pin to a specific Device OS version or semver range, e.g. ^4.0.0
    # Required: false
    device-os-version: 'default'
      
    # Auto versioning for product firmware
    # If true, the action will automatically increment the product firmware version. See AUTO_VERSION.md for more details.
    # Required: false
    auto-version: 'false'

    # Macro name for product firmware version
    # Required: false
    auto-version-macro-name: 'PRODUCT_VERSION'
    
    # Particle access token
    # If provided, the action will use the Particle Cloud Compiler instead of compiling within the GitHub Action runner
    # Required: false
    particle-access-token: ''
```

### Outputs

* `artifact-path`: Path to the compiled binary artifact. Example: `output/firmware-argon-2.3.1.bin`
* `device-os-version`: The Device OS version that was used for compilation. This may differ from the requested version if the requested version is a semver range or `latest` or `latest-lts`. Example: `2.3.1`
* `firmware-version`: The product firmware version integer. This output is undefined when sources are not a product firmware.
* `firmware-version-updated`: Boolean value indicating whether the product firmware version was updated. Can only be true with auto-version enabled.

### Example Pipeline

This is a simple example of a GitHub Actions pipeline that compiles a firmware project and uploads the compiled binary as an artifact.

```yaml
name: CI

on: [push]

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@main
        with:
          particle-platform-name: 'boron'
          sources-folder: 'src'

      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: tracker-firmware
          path: ${{ steps.compile.outputs.artifact-path }}
```

Compilation occurs inside the GitHub Action runner using the Particle [Buildpack Docker images](https://github.com/particle-iot/firmware-buildpack-builder).

See [`action.yml`](action.yml) for the full documentation for this action's inputs and outputs.

### Cloud Compilation

To compile in the cloud, set the `particle-access-token` input to a Particle access token. Example:

```yaml
      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@main
        with:
          particle-access-token: ${{ secrets.PARTICLE_ACCESS_TOKEN }}
          particle-platform-name: 'boron'
          sources-folder: 'src'
```

Compiling in the cloud can be 30 to 60 seconds faster than compiling locally. 

Compiling locally has overhead related to downloading and extracting buildpack Docker images to the Action runner.

Your access token should be tightly scoped to the minimum required permissions. 

Here's an example of how to create a new Particle access token for use with this action:

```bash
# Create a new Particle access token with the `binary:compile` scope
$ export TOKEN=<your Particle access token>
$ export ORG_SLUG=<your Particle organization slug, visible in urls>
$ curl "https://api.particle.io/v1/orgs/$ORG_SLUG/team?access_token=$TOKEN" -H "Content-Type: application/json" -d '{ "friendly_name": "GitHub Actions Compiling", "scopes": [ "binary:compile" ] }'
{
  "ok": true,
  "created": {
    "username": "github-actions-compiling+nz3nseew@api.particle.io",
    "is_programmatic": true,
    "tokens": [
      {
        "token": "9383649a07fb505c6b4ae9d5exampleexample"
      }
    ]
  }
}
```


## Known Issues

### Missing libraries or dependencies

The Cloud Compiler [automatically downloads](https://docs.particle.io/firmware/best-practices/libraries/#cloud-vs-local-compiles)
libraries defined in the `project.properties` file. 

The `compile-action` does not currently download libraries when compiling inside the Action runner.

There are a few ways to work around this:
1. Check in your dependencies to your repository
1. Use the Cloud Compiler by setting the `particle-access-token` input
1. Use the [Particle CLI](https://docs.particle.io/tutorials/developer-tools/cli/) to install dependencies in CI

Here is an example that installs the Particle CLI and uses it to install libraries defined in `project.properties`:

```yaml

      # Change working-directory to your sources folder
      # Make sure to set a PARTICLE_ACCESS_TOKEN secret in your repository
      - name: Install project dependencies
        working-directory: src
        run: |
          npm install -g particle-cli
          particle login --token "${{ secrets.PARTICLE_ACCESS_TOKEN }}"
          # Make into an extended project if src doesn't exist
          # Move all files except project.properties to src
          if [ -f project.properties ] && [ ! -d src ]; then
            mkdir src
            find . ! -name project.properties ! -name src ! -name . -exec mv {} src \;
          fi
          particle library install --vendored -y 
```
