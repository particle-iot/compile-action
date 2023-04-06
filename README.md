# Particle Compile Action
[![Build and Test](https://github.com/particle-iot/compile-action/actions/workflows/test.yml/badge.svg)](https://github.com/particle-iot/compile-action/actions/workflows/test.yml)

A GitHub Action to compile Particle application firmware

## Usage

```yaml
- uses: particle-iot/compile-action@v1
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
    #   latest:     the most recent Device OS version for the platform
    #   latest-lts: the most recent LTS Device OS version for the platform
    #   <version>:  a specific Device OS version, e.g. 2.3.1
    #   ^<version>: a semver range, e.g. ^5.3.0
    # For production projects, you should pin to a specific Device OS version or semver range, e.g. ^4.0.0
    # Required: false
    device-os-version: 'latest-lts'
      
    # Particle access token
    # If provided, the action will use the Particle Cloud Compiler instead of compiling within the GitHub Action runner
    # Required: false
    particle-access-token: ''
```

### Outputs

* `artifact-path`: Path to the compiled binary artifact. Typically, it will be `output/firmware.bin`
* `device-os-version`: The Device OS version that was used for compilation. This may differ from the requested version if the requested version is a semver range or `latest` or `latest-lts`. Example: `2.3.1`

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
        uses: particle-iot/compile-action@v1
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
        uses: particle-iot/compile-action@v1
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
