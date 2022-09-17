# Announcement Drafter

[![Web App CI / CD](https://github.com/philip-gai/announcement-drafter/actions/workflows/web-app-ci-cd.yml/badge.svg)](https://github.com/philip-gai/announcement-drafter/actions/workflows/web-app-ci-cd.yml)
[![App Service CI / CD](https://github.com/philip-gai/announcement-drafter/actions/workflows/infrastructure-ci-cd.yml/badge.svg)](https://github.com/philip-gai/announcement-drafter/actions/workflows/infrastructure-ci-cd.yml)
![Language Count](https://img.shields.io/github/languages/count/philip-gai/announcement-drafter?label=Languages)
![Top Language](https://img.shields.io/github/languages/top/philip-gai/announcement-drafter)
![GitHub Repo stars](https://img.shields.io/github/stars/philip-gai/announcement-drafter?style=social)

A 🤖 &nbsp;for drafting and publishing new GitHub discussions using pull requests.

Do you use GitHub discussions? Do you create announcements for your open-source projects or team posts? How do you get feedback or peer reviews on your post before creating it?

Now you can:

&nbsp;&nbsp;&nbsp;&nbsp;1️⃣ &nbsp;Create a pull request to get feedback from your teammates on your announcement\
&nbsp;&nbsp;&nbsp;&nbsp;2️⃣ &nbsp;Merge the pull request to have your announcement posted!

You can even use private repos to draft announcements and get feedback privately, and on merge have the announcement created in your public repo.

No more copy/pasting your post content into Google Docs. No more rewriting the markdown. Write the markdown once, get feedback and merge 🚀 This works on repository discussions, organization discussions, and legacy team posts.

## Getting Started

1. Install the [GitHub App](https://github.com/apps/announcement-drafter) and authorize it for any repositories or orgs you would like it to watch or post to.
2. Add a `.github/announcement-drafter.yml` (not `.yaml`) configuration file to any repositories you want the bot to watch.

   1. Provide what folders you want the `announcement-drafter` bot to watch and (optionally) what folders you would like it to ignore when new pull requests are open.

   ```yml
   watch_folders:
     - docs/discussions/
   ```

3. Create a markdown (`*.md`) file with some metadata at the top - see [Draft an Org or Repository Discussion](#draft-an-org-or-repository-discussion) or [Draft a team post](#draft-a-team-post)
4. Write your discussion in the body of the markdown file
5. Create a pull request
6. `announcement-drafter` will pick it up
7. When the pull request is merged, it will create the discussion for you

### Draft an Org or Repository Discussion

A note on org discussions: Org discussions are backed by repository discussions, so just point to the repository used by your org discussions and 🪄 it will work!

```markdown
<!--
repo: https://github.com/philip-gai/announcement-drafter-demo
category: announcements
-->

<!-- This is the discussion title -->
# Hello World! 👋

<!-- This is the discussion body -->
Hello beautiful world! 🌎

```

### Draft a Team Post

```markdown
<!--
team: https://github.com/orgs/elastico-group/teams/everyone
-->

<!-- This is the post title -->
# Hello World! 👋

<!-- This is the post body -->
Hello beautiful world! 🌎

```

## Demos

Demo repo: [announcement-drafter demo]

## Markdown Metadata

| Name             | Description                                                                                                                                                                      | Required                                                 | Example                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `repository` or `repo`     | The full url to the repository to create the discussion in<br/>**Prerequisites:**<br/>&nbsp;&nbsp;1. Discussions are enabled<br/>&nbsp;&nbsp;2. The app is installed on the repo | **Conditional**: Required if no `team` is provided       | `https://github.com/philip-gai/announcement-drafter-demo` |
| `team`           | The full url to the team to create the discussion in<br/>**Prerequisites:**<br/>&nbsp;&nbsp;1. The app is installed on the team organization                                     | **Conditional**: Required if no `repository` is provided | `https://github.com/orgs/elastico-group/teams/everyone`   |
| `category`       | The name of the discussion category                                                                                                                                              | **Conditional**: Required if `repository` is provided    | `announcements`                                           |
| Discussion Title | The title of your discussion should be the first top-level header (i.e. `# Discussion Title`)                                                                                    | Yes                                                      | See [Example](#draft-an-org-or-repository-discussion)                                  |
| Discussion Body  | The body of your discussion is everything after the top-level header                                                                                                             | Yes                                                      | See [Example](#draft-an-org-or-repository-discussion)                                  |

## App Configuration Options

These options should go in your repository's `.github/announcement-drafter.yml` file.

| Name             | Description                                                                                                                                                                                                                                                                                              | Required | Example                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `watch_folders`  | A list of what folders (relative paths) `announcement-drafter` should watch when new pull requests are open<br/>&nbsp;&nbsp;1. It is recommened to include the final `/` in the path<br/>&nbsp;&nbsp;2. `announcement-drafter` will also watch all subfolders unless you ignore them in `ignore_folders` | Yes      | [See demo config][announcement-drafter demo config] |
| `ignore_folders` | A list of what folders (relative paths) `announcement-drafter` should _ignore_ when new pull requests are open                                                                                                                                                                                           | No       | [See demo config][announcement-drafter demo config] |

Example announcement-drafter.yml:

```yml
watch_folders:
  - docs/discussions/
ignore_folders:
  - docs/discussions/ignore/
```

## FAQ

### I opened a pull request, but I never received a comment on the pull request from Announcement Drafter. What did I do wrong?

Make sure that you:

1. Installed the app on the repository you created the pull request from
2. Added a `.github/announcement-drafter.yml` file to the repository with `watch_folders`
3. Created a new `*.md` file inside one of the `watch_folders` from a branch
   1. Announcement Drafter will *only* process files that were added. It will not process files that were removed, modified, renamed, copied, changed or unchanged.
4. Opened a pull request targeting the repository's default branch (i.e. `main`)
   1. Announcement Drafter will ignore draft pull requests

Also, try closing and re-opening your PR after making any changes to the announcement drafter configuration to trigger the flow again.

If you followed all of the above steps and are still experiencing issues, please [open an issue](https://github.com/philip-gai/announcement-drafter/issues/new?assignees=&labels=bug&template=bug_report.md&title=) :slightly_smiling_face:

## Contributing

If you have suggestions for how announcement-drafter could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

[announcement-drafter demo]: https://github.com/philip-gai/announcement-drafter-demo
[announcement-drafter demo config]: https://github.com/philip-gai/announcement-drafter-demo/blob/main/.github/announcement-drafter.yml
