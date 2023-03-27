# How to update all npm packages

1. Install the tool `npm install -g npm-check-updates` (already installed on the Codespace)
2. Update the package.json `ncu --upgrade`
3. Validate the changes to your package.json
4. Install the new packages `npm install`
5. Test the app
   1. See example PR: https://github.com/philip-gai/announcement-drafter/pull/85
