# Solution Notes

## Challenge

* We want to ensure code reviews are being done to code before it is added to a repository.

## Assumptions

* New repos are created frequently and need to automatically inherit agreed policies.
* New repos will be initialized with a README at creation.
* We aren't worried about protecting the default branch for repos which are not initialized with a default branch at creation.
* We are using a single GitHub Organization.

## Desired state

* When a new repo is created:
  * The default branch is protected
* An issue is automatically created in the repo
  * Including a @mention
  * Documenting the creation of the repo
  * Confirming the protection rule(s) applied

## How the solution works

### Components

1. Your GitHub Organization
2. A GitHub webhook for your Organization
3. An Azure Function, to:
    * Listen for the webhook
    * Exercise the branch protection
    * Create the GitHub Issue

## Demonstration

## Installation
1. Create Azure Function using Node.JS
    1. Make note of default Function Keys secret and the URL

1. Create or access your GitHub Organization
1. Go to Settings for the Organization
1. Go to Webhooks
1. Add a Webhook
    1. For payload URL, paste your Azure Function URL
    1. For content type, select `application/json`
    1. For secret, paste the Azure Function Keys default secret from the previous step
    1. Select "Let me select individual events"; ensure that only the box for "Repositories" is selected
    1. Ensure the box for "Active" is selected, to enable this webhook
    1. Click Add Webhook button 

1. In your GitHub profile settings, go to Developer Settings
1. Create a personal access token

1. At the top of the Azure Function `index.js` file, paste in your GitHub auth token, the username you want mentioned in GitHub Issues, and the Azure Function Keys secret:
```
// parameters you may change
const octokit = new Octokit({ auth: '<gh-auth-token-here>'});         // GitHub auth token
const default_branch = "main";                                  
const name_to_mention = "<user-here>";                                // Name to mention in issue when created
const hmac = Crypto.createHmac("sha1", "<azure-function-key-here>");  // Azure Function Keys secret
```


## FAQ

1. What does it mean for a branch to be protected?

## References
 
1. [Microsoft Learn, Monitor GitHub events by using a webhook with Azure Functions](https://docs.microsoft.com/en-us/learn/modules/monitor-github-events-with-a-function-triggered-by-a-webhook/)
1. [Integrate Key Vault Secrets With Azure Functions](https://daniel-krzyczkowski.github.io/Integrate-Key-Vault-Secrets-With-Azure-Functions/)
