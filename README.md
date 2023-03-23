# Particle Compile Action

A GitHub Action to compile Particle firmware.

## Usage

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
          particle_platform_name: 'boron'
          sources_folder: 'src'

      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: tracker-firmware
          path: ${{ steps.compile.outputs.artifact_path }}
```

Compilation occurs inside the GitHub Action runner using the Particle [Buildpack Docker images](https://github.com/particle-iot/firmware-buildpack-builder).

See [`action.yml`](action.yml) for the full documentation for this action's inputs and outputs.

### Cloud Compilation

To compile in the cloud, set the `particle_access_token` input to a Particle access token. Example:

```yaml
      - name: Compile application
        id: compile
        uses: particle-iot/compile-action@v1
        with:
          particle_access_token: ${{ secrets.PARTICLE_ACCESS_TOKEN }}
          particle_platform_name: 'boron'
          sources_folder: 'src'
```

Compiling in the cloud can be 30 to 60 seconds faster than compiling locally. This is due to overhead related to downloading and extracting the buildpack Docker image.

Your access token should be tightly scoped to the minimum required permissions. 

Here's an example of how to create a new Particle access token for use with this action:

```bash
# Create a new Particle access token with the `binary:compile` scope
$ export TOKEN=<your Particle access token>
$ export ORG_SLUG=<your Particle organization slug, vislble in urls>
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

## Development

Use the following commands to run the action locally:

```
nvm use
npm install
npm run all

INPUT_SOURCES_FOLDER=test/fixtures/single-file-firmware INPUT_PARTICLE_PLATFORM_NAME=argon node dist/index.js

# To Cloud Compile instead of local compile add the following env var to the command above
INPUT_PARTICLE_ACCESS_TOKEN=1234
```
