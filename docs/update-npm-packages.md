# How to update all npm packages

1. Install the tool `npm install -g npm-check-updates` (already installed on the Codespace)
2. Update the package.json
   1. `cd web-app`
   2. `ncu --upgrade`
3. Validate the changes to your package.json
4. Clean and install the new packages
   1. `npm clean-install`
5. Upgrade your global typsscript installationand verify
   1. Upgrade: `npm install -g typescript@latest`
   2. Verify: `tsc -v`
6. [Test the app](./testing.md)
