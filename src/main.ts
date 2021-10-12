import { IssueCommentEventHandler } from "./issueCommentEventHandler";
import { ApplicationFunctionOptions, Probot, ProbotOctokit } from "probot";
import * as queryString from "query-string";
import fetch from "node-fetch";

export = async (app: Probot, options: ApplicationFunctionOptions) => {
  try {
    app.log.info("Running Probot app...");

    app.log.debug("Initializaing event handlers...");
    const issueCommentEventHandler = new IssueCommentEventHandler();
    app.log.debug("Done.");

    app.on("issue_comment.created", (context) =>
      issueCommentEventHandler.onCreated(context)
    );

    app.log.info("Getting express router...");

    const router = options.getRouter && options.getRouter("/");
    if (!router) throw new Error("Invalid router");

    app.log.info("Adding router...");
    router.get("/login", (req, res) => {
      // GitHub needs us to tell it where to redirect users after they've authenticated
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");

      const params = queryString.stringify({
        client_id: process.env["GITHUB_CLIENT_ID"] || "Missing client id",
        redirect_uri: `${protocol}://${host}${process.env["CALLBACK_URL"]}`,
      });

      const url = `https://github.com/login/oauth/authorize?${params}`;
      res.redirect(url);
    });

    router.get("/login/callback", async (req, res) => {
      // Exchange our "code" and credentials for a real token
      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          body: JSON.stringify({
            client_id: process.env["GITHUB_CLIENT_ID"] || "Missing client id",
            client_secret:
              process.env["GITHUB_CLIENT_SECRET"] || "Missing client secret",
            code: (req.query.code as string) || "Bad code",
          }),
          method: "post",
          headers: { "Content-Type": "application/json" },
        }
      );

      console.log(tokenRes.ok);
      const body = queryString.parse(await tokenRes.text());
      console.log(body);

      // Authenticate our Octokit client with the new token
      const token = (body.access_token as string) || "Bad access token";
      console.log(token);

      const myOctokit = new ProbotOctokit({
        // any options you'd pass to Octokit
        auth: { token: token },
        // and a logger
        log: app.log.child({ name: "my-octokit" }),
      });

      // Get the currently authenticated user
      const user = await myOctokit.users.getAuthenticated();
      console.log(user.data.login); // <-- This is what we want!

      // Redirect after login
      res.redirect("/");
    });
  } catch (error: unknown) {
    let errorMessage = "An unknown error has occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    app.log.error(errorMessage);
  }
};
