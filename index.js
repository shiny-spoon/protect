// Require github to authenticate to this Azure Functions listener
const Crypto = require("crypto");

// Octokit is a library to help use the github api
const { Octokit } = require("octokit");


// =============================================================================
// Change these parameters in the Azure Key Vault

// Token for authenticating to GitHub
const octokit = new Octokit({ auth: process.env.GitHubTokenKeyVault }); 
// Azure Functions secret fot GitHub to authenticate with
const azuresecret = process.env.AzureFunctionSecretKeyVault
// Name to mention in issue when created
const name_to_mention = process.env.NameToMentionKeyVault;              

// =============================================================================


module.exports = async function (context, req) {
  context.log("JavaScript HTTP trigger function processed a request.");

  const hookdata = req.body;

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


  // If GitHub webhook secret looks good
  if (!shaSignature.localeCompare(gitHubSignature)) {
    num_branches = 0;
    default_branch = null;


    // Check default branch
    await octokit.rest.repos
    .get({
      owner: hookdata.repository.owner.login,
      repo: hookdata.repository.name,
    })
    .then(({ data, headers, status }) => { 
      if(status == 200) {
        context.log("Default Branch from API read: " + data.default_branch);
        default_branch = data.default_branch;
      }
    });

    // Determine if repo has a branch
    await octokit
      .request("GET /repos/{owner}/{repo}/branches", {
        owner: hookdata.repository.owner.login,
        repo: hookdata.repository.name,
      })
      .then(({ data, headers, status }) => { 
        num_branches = data.length;     // This gets us the count of branches in the repo
        context.log("Branches: " + num_branches);
      });

    // If we determine that a repo was created and it has a branch, we'll assume we can go ahead and apply branch protection to the default branch
    if (hookdata.action == "created" && num_branches > 0) {
      context.res = {
        body:
          "Received notification. Action is " +
          hookdata.action +
          ". " +
          "Repo is " +
          hookdata.repository.name +
          ". " +
          "Reported default branch is " +
          hookdata.repository.default_branch +
          ". " +
          "Private is " +
          hookdata.repository.private +
          ".",
      };

      // apply branch protection
      context.log(
        "Autoprotecting " +
          default_branch +
          " for repo " +
          hookdata.repository.name
      );
      branchprotected = false;
      await octokit.rest.repos
        .updateBranchProtection({
          owner: hookdata.repository.owner.login,
          repo: hookdata.repository.name,
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
        context.log("Creating issue for repo " + hookdata.repository.name);
        await octokit.rest.issues
          .create({
            owner: hookdata.repository.owner.login,
            repo: hookdata.repository.name,
            title:
              "Protected default branch for repo " + hookdata.repository.name,
            body:
              "@" +
              name_to_mention +
              " Hello world. Repo " +
              hookdata.repository.full_name +
              " created. Created at " +
              hookdata.repository.created_at +
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
      } else {
        responsetext = "Not a repo creation event.";
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
