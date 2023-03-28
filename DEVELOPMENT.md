## Development

Use the following commands to run the action locally:

```
nvm use
npm install
npm run all

env "INPUT_SOURCES-FOLDER=test/fixtures/single-file-firmware" env "INPUT_PARTICLE-PLATFORM-NAME=argon" node dist/index.js

# To Cloud Compile instead of local compile add the following env var to the string above
env "INPUT_PARTICLE-ACCESS-TOKEN=1234"
```
