## Development

Use the following commands to run the action locally:

```
nvm use
npm install
npm run all

env "INPUT_SOURCES-FOLDER=test/fixtures/single-file-firmware" env "INPUT_PARTICLE-PLATFORM-NAME=argon" npm start

# To Cloud Compile instead of local compile add the following env var to npm start cmd above
env "INPUT_PARTICLE-ACCESS-TOKEN=1234"
```
