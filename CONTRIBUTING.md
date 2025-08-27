# Contributions

All contributors must first sign the [Particle Individual Contributor License Agreement (CLA)](https://part.cl/icla), which is based on the Google CLA, and provides the Particle team a license to re-distribute your contributions.

## Submitting a pull request

1. Fork and clone the repository
1. Use Node.js version specified in the `.nvmrc` file: `nvm use`
1. Configure and install the dependencies: `npm install`
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change, add tests, and make sure the tests still pass: `npm run test`
1. Make sure your code passes lint checks: `npm run lint`
1. Update `dist/index.js` using `npm run build`. This creates a single javascript file that is used as an entrypoint for the action
1. Push to your fork and submit a pull request
1. Wait for your pull request to be reviewed and merged

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Keep each pull request small and focused on a single feature or bug fix.
- Familiarize yourself with the code base, and follow the formatting principles adhered to in the surrounding code.
- Wherever possible, provide unit tests for your contributions.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
- [Writing good commit messages](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)
