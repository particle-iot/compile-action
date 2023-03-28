# Release

The release/publish process is [automated](.github/workflows/publish.yml) using GitHub Actions.

## Process

1. Merge all pull requests that are ready into the `main` branch
1. Create a new [GitHub Release](https://github.com/particle-iot/compile-action/releases/new)
   1. Define the new tag following semantic versioning. _It must start with `v`, e.g. `v1.1.0`_. Prerelease tags are supported, e.g. `v1.1.0-rc.1`
   2. Generate release notes
   3. Check pre-release if appropriate
   4. Click publish release 
   
GitHub Actions will automatically package the compiled JS file.

It will force push `action.yml` and the compiled JS file to the release's tag. 

The release process will keep major (`v1`) and minor (`v1.1`) tags current to the latest appropriate commit (this is skipped for pre-releases).
