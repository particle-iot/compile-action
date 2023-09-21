## Development

Use the following commands to run the action locally:

```
nvm use
npm install
npm run all

env "INPUT_SOURCES-FOLDER=test/fixtures/single-file-firmware" env "INPUT_PARTICLE-PLATFORM-NAME=argon" env "INPUT_DEVICE-OS-VERSION=default" npm start

# To Cloud Compile instead of local compile add the following env var to the `npm start` cmd above
env "INPUT_PARTICLE-ACCESS-TOKEN=1234"
```

The default values from `action.yml` are not set when running the action locally. You must set the defaults manually in the `npm start` command. 


## Update platform list

To generate the list of supported platforms, run the following command after installing all dependencies:

```console
cat node_modules/@particle/device-constants/dist/js/constants.json | jq -r '.[] | select(.public == true) | .name' | awk '{printf "%s, ", $0}' | sed 's/, $//'
```
