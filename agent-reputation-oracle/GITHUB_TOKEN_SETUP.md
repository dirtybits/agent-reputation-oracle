# Setting Up Fine-Grained GitHub Token

## Why?
Limit OpenClaw/Sparky to only read-write access to the `agent-reputation-oracle` repo, not all your repos.

## Steps:

1. **Go to GitHub Settings:**
   https://github.com/settings/personal-access-tokens/new

2. **Create Fine-Grained Token:**
   - **Token name:** `openclaw-agent-reputation-oracle`
   - **Expiration:** Choose your preference (30 days, 90 days, etc.)
   - **Resource owner:** dirtybits
   - **Repository access:** "Only select repositories"
     - Select: `agent-reputation-oracle` only
   
3. **Permissions (Repository permissions):**
   - **Contents:** Read and write
   - **Pull requests:** Read and write (if needed)
   - **Metadata:** Read-only (required)
   
4. **Generate token** and copy it

5. **Configure gh CLI with new token:**
   ```bash
   # Logout current session
   gh auth logout
   
   # Login with new token
   gh auth login
   # Choose: GitHub.com
   # Choose: HTTPS
   # Paste your fine-grained token when prompted
   ```

6. **Test it:**
   ```bash
   # Should work (has access to this repo)
   gh repo view dirtybits/agent-reputation-oracle
   
   # Should fail (no access to other repos)
   gh repo view dirtybits/some-other-repo
   ```

## Alternative: Service Account

For even better security, create a dedicated GitHub account (e.g., `oddbox-bot`) and:
1. Give it collaborator access to only the repos you want
2. Use that account's token for OpenClaw

This way your personal account stays completely isolated.

## After Hackathon

If you want to revoke all access:
```bash
gh auth logout
# Or revoke the token at: https://github.com/settings/tokens
```
