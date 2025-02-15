# Particle Compile Action
[![Build and Test](https://github.com/particle-iot/compile-action/actions/workflows/test.yml/badge.svg)](https://github.com/particle-iot/compile-action/actions/workflows/test.yml)

A GitHub Action to compile Particle application firmware

Other Actions for firmware development: Compile | [Flash Device](https://github.com/particle-iot/flash-device-action) | [Firmware Upload](https://github.com/particle-iot/firmware-upload-action)

## Usage

```yaml
- uses: particle-iot/compile-action@v1
  with:
    # The platform name to target the compilation
    # Allowed values: core, photon, p1, electron, argon, boron, xenon, esomx, bsom, b5som, tracker, trackerm, p2, msom, electron2
    # Required: true
    particle-platform-name: ''
      
    # This is your Particle project directory
    # It contains your source code, libraries, and the project.properties file
    # Required: false
    sources-folder: '.'
      
    # Target Device OS firmware version
    # Allowed values:
    #   default:    the default Device OS version for the platform (latest LTS when available, otherwise latest)
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

Also see official [Particle documentation](https://docs.particle.io/firmware/best-practices/github-actions/) for more details.

### Outputs

* `firmware-path`: Path to the compiled binary artifact. Example: `firmware-argon-2.3.1.bin`
* `target-path`: Path to the folder with compiled firmware files and their associated object files. The folder includes the firmware binary, ELF, HEX, and MAP files, along with object files. Not available when particle-access-token is set (cloud compile).
* `device-os-version`: The Device OS version that was used for compilation. This may differ from the requested version if the requested version is a semver range or `latest` or `latest-lts`. Example: `2.3.1`
* `firmware-version`: The product firmware version integer. This output is undefined when sources are not a product firmware.
* `firmware-version-updated`: Boolean value indicating whether the product firmware version was updated. Can only be true with auto-version enabled.

### Example Pipeline

This is a simple example of a GitHub Actions pipeline that compiles a firmware project and uploads the compiled binary as an artifact.

```yaml
name: Compile

on: [push]

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@v1
        with:
          particle-platform-name: 'boron'

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: firmware
          path: |
            ${{ steps.compile.outputs.firmware-path }}
            ${{ steps.compile.outputs.target-path }}
```

Compilation occurs inside the GitHub Action runner using the Particle [Buildpack Docker images](https://github.com/particle-iot/firmware-buildpack-builder).

See [`action.yml`](action.yml) for the full documentation for this action's inputs and outputs.

### Automatic Product Firmware Versioning

To improve the management of product firmware [version numbers](https://docs.particle.io/reference/device-os/api/macros/product_version/), `compile-action` offers an auto-versioning feature that automates the process and ensures consistency.

This feature can be configured to work with your GitHub Actions workflow in various ways, including manual, semi-automated, or continuous versioning.

For more details on how to enable and use this feature, please refer to the [AUTO_VERSION.md](./AUTO_VERSION.md) file.

### Cloud Compilation

To compile in the cloud, set the `particle-access-token` input to a Particle access token. Example:

```yaml
      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@v1
        with:
          particle-access-token: ${{ secrets.PARTICLE_ACCESS_TOKEN }}
          particle-platform-name: 'boron'
```

Compiling in the cloud can be 30 to 60 seconds faster than compiling locally. 
Compiling locally has overhead related to downloading and extracting buildpack Docker images to the Action runner.

The access token should be an [API User](https://docs.particle.io/getting-started/cloud/cloud-api/#api-users) token.
It needs at least one scope to be able to access the cloud compiler.
There is no scope for cloud compilation specifically, but your access token should be tightly scoped to the minimum required permissions.

If you plan to [flash firmware](https://github.com/particle-iot/flash-device-action) to test devices, it will need the `devices:update` scope.
If you plan to [upload product firmware binaries](https://github.com/particle-iot/firmware-upload-action) to the cloud, it will need the `firmware:create` scope.

To create an API user, go to the Team page in your organization and click "Add API User".

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

      # Make sure to set a PARTICLE_ACCESS_TOKEN secret in your repository
      - name: Install project dependencies
        run: |
          npm install -g particle-cli
          particle login --token "${{ secrets.PARTICLE_ACCESS_TOKEN }}"
          particle library install --vendored -y 
```

### Automatic versioning and ino files

Automatic product firmware versioning does currently not work with `.ino` files. 

The `firmware-version` output will not contain the correct version number when compiling `.ino` files.

The workaround is to use `.cpp` files instead.

Read the [preprocessor](https://docs.particle.io/reference/device-os/api/preprocessor/preprocessor/) docs
to help transform your `.ino` files into `.cpp` in your repository. 

The CLI command `particle preprocess app.ino` can do a conversion from ino to cpp. Commit the cpp file and delete the ino file. 
Since this is a one-time change, you can ignore and delete the "do not edit" warning in the cpp file.
