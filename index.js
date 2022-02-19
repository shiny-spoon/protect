// Require github to authenticate to this Azure Functions listener
const Crypto = require("crypto");

// Octokit is a library to help use the github api
const { Octokit } = require("octokit");

// =============================================================================
// Change these parameters in the Azure Key Vault

// Token for authenticating to GitHub
const octokit = new Octokit({ auth: process.env.GitHubTokenKeyVault });
// Azure Functions secret fot GitHub to authenticate with
const azuresecret = process.env.AzureFunctionSecretKeyVault;
// Name to mention in issue when created
const name_to_mention = process.env.NameToMentionKeyVault;

// =============================================================================

module.exports = async function (context, req) {
  context.log("JavaScript HTTP trigger function processed a request.");

  const webhookpayload = req.body;

  // Prepare Azure Functions secret to compare with what is sent by GitHub webhook
  const hmac = Crypto.createHmac("sha1", azuresecret);
  const signature = hmac.update(JSON.stringify(req.body)).digest("hex");
  const shaSignature = `sha1=${signature}`;
  const gitHubSignature = req.headers["x-hub-signature"];

  // Confirm we're authenticating to GitHub properly
  const {
    data: { login },
  } = await octokit.rest.users.getAuthenticated();
  context.log("Authenticated to GitHub as %s", login);

  // If GitHub webhook secret looks good, then we can continue with our intent
  if (!shaSignature.localeCompare(gitHubSignature)) {
    num_branches = 0;
    default_branch = null;
    default_branch_protected = null;

    // Determine if repo has any branches
    await octokit
      .request("GET /repos/{owner}/{repo}/branches", {
        owner: webhookpayload.repository.owner.login,
        repo: webhookpayload.repository.name,
      })
      .then(({ data, headers, status }) => {
        num_branches = data.length; // This gets us the count of branches in the repo
        context.log("Branches: " + num_branches);
      });

    // Check default branch (the name sent in the original webhook isn't always right)
    if (num_branches > 0) {
      await octokit.rest.repos
        .get({
          owner: webhookpayload.repository.owner.login,
          repo: webhookpayload.repository.name,
        })
        .then(({ data, headers, status }) => {
          if (status == 200) {
            context.log("Default Branch from API read: " + data.default_branch);
            default_branch = data.default_branch;
          }
        });
    }

    // Determine if default branch is already protected or unprotected
    if (num_branches > 0) {
      await octokit
        .request("GET /repos/{owner}/{repo}/branches/{branch}", {
          owner: webhookpayload.repository.owner.login,
          repo: webhookpayload.repository.name,
          branch: default_branch,
        })
        .then(({ data, headers, status }) => {
          default_branch_protected = data.protected; // This gets us the count of branches in the repo
          context.log("Protection: " + default_branch_protected);
        });
    }

    // If we determine that a repo was created and it has a branch, we'll assume we can go ahead and apply branch protection to the default branch
    //if (webhookpayload.action == "created" && num_branches > 0) {
    if (
      webhookpayload.action == "created" &&
      num_branches > 0 &&
      default_branch_protected == false
    ) {
      context.res = {
        body:
          "Received notification. Action is " +
          webhookpayload.action +
          ". " +
          "Repo is " +
          webhookpayload.repository.name +
          ". " +
          "Reported default branch is " +
          webhookpayload.repository.default_branch +
          ". " +
          "Private is " +
          webhookpayload.repository.private +
          ".",
      };

      // apply branch protection
      context.log(
        "Autoprotecting " +
          default_branch +
          " for repo " +
          webhookpayload.repository.name
      );
      branchprotected = false;
      await octokit.rest.repos
        .updateBranchProtection({
          owner: webhookpayload.repository.owner.login,
          repo: webhookpayload.repository.name,
          branch: default_branch,
          required_status_checks: null,
          enforce_admins: false,
          required_pull_request_reviews: null,
          restrictions: { teams: [], users: [] }, // This rule means no one is allowed to push to default
        })
        .then(({ data, headers, status }) => {
          if (status == 200) {
            // Status 200 OK
            branchprotected = true;
            context.log("Successfully protected branch.");
          }
        });

      createdissue = false;
      if (branchprotected) {
        // create issue
        context.log(
          "Creating issue for repo " + webhookpayload.repository.name
        );
        await octokit.rest.issues
          .create({
            owner: webhookpayload.repository.owner.login,
            repo: webhookpayload.repository.name,
            title:
              "Protected default branch for repo " +
              webhookpayload.repository.name,
            body:
              "@" +
              name_to_mention +
              " Hello world. Repo " +
              webhookpayload.repository.full_name +
              " created. Created at " +
              webhookpayload.repository.created_at +
              ". Thank you.",
          })
          .then(({ data, headers, status }) => {
            if (status == 201) {
              // Status 201 Created
              createdissue = true;
              context.log("Successfully created issue.");
            }
          });
      }
    }
    // No protection action to take
    else {
      if (num_branches == 0) {
        responsetext = "No branch present.";
      } else if (default_branch_protected == true) {
        responsetext = "Default branch already protected";
      } else {
        responsetext = "No action taken.";
      }
      context.res = {
        status: 200,
        body: responsetext,
      };
    }
  }
  // if github secret does NOT look good
  else {
    context.res = {
      status: 401,
      body: "Signatures don't match",
    };
  }
};
