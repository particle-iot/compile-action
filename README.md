# Particle Compile Action

## Local Testing
```
nvm use
npm install
npm run all

INPUT_SOURCES_FOLDER=test/fixtures/single-file-firmware INPUT_PARTICLE_PLATFORM_NAME=argon node dist/index.js

# To Cloud Compile instead of local compile add the following env var to the command above
INPUT_PARTICLE_ACCESS_TOKEN=1234
```
