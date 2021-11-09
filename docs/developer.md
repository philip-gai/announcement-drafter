# Developer Documentation

Publish new GitHub discussions using your existing repository's PR workflows 📬

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Usage

`/create-branch-ado` or `/cb-ado` without any argument will create a branch with the naming scheme `users/<github handle>/<issue number>-<issue title>` off of the default branch set in your ADO Repo.

Additional parameters can be passed to customize the branch:

### Username

Appending `username <username>` after `/create-branch-ado` or `/cb-ado` will allow you to customize what you would like to have following `users/` in the branch name.

For example, the command:

```sh
/create-branch-ado username jdoe
```

would create the the following branch name:

```sh
users/jdoe/<issue number>-<issue title>
```

### Branch

If you want to branch off of a specific branch:

```plaintext
/cb-ado branch <branchname>
```

## Contributing

If you have suggestions for how announcement-drafter could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 Philip Gai <philipmgai@github.com>
