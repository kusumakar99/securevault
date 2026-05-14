# Deploying SecureVault to Azure App Service

This guide deploys the app to Azure App Service (Linux, Node 20) with an Azure Files share mounted at `/home/data` for SQLite + uploads, and continuous deployment from GitHub via GitHub Actions.

## One-time setup

Run the commands below from PowerShell (Windows) or bash. You need the Azure CLI installed and to be logged in: `az login`.

### 1. Variables

```powershell
$RG = "rg-securevault"
$LOCATION = "eastus"
$PLAN = "asp-securevault"
$APP = "securevault-app"
$STORAGE = "stsecurevault$([guid]::NewGuid().ToString('N').Substring(0,6))"  # globally-unique
$SHARE = "vaultdata"
```

### 2. Create the resources

```powershell
az group create --name $RG --location $LOCATION
az appservice plan create --name $PLAN --resource-group $RG --sku B1 --is-linux
az webapp create --resource-group $RG --plan $PLAN --name $APP --runtime "NODE:20-lts"

# Storage account + file share for persistent data
az storage account create --name $STORAGE --resource-group $RG --location $LOCATION --sku Standard_LRS
$STORAGE_KEY = az storage account keys list --resource-group $RG --account-name $STORAGE --query "[0].value" -o tsv
az storage share-rm create --resource-group $RG --storage-account $STORAGE --name $SHARE --quota 5

# Mount the share at /home/data inside the App Service
az webapp config storage-account add `
  --resource-group $RG --name $APP `
  --custom-id vaultdata `
  --storage-type AzureFiles `
  --account-name $STORAGE `
  --share-name $SHARE `
  --access-key $STORAGE_KEY `
  --mount-path /home/data
```

### 3. App Service configuration (env vars)

Replace the placeholder secrets with real values, then run:

```powershell
az webapp config appsettings set --resource-group $RG --name $APP --settings `
  NODE_ENV=production `
  WEBSITES_PORT=3001 `
  PORT=3001 `
  DATA_DIR=/home/data `
  JWT_SECRET="<long-random-string>" `
  APP_URL="https://$APP.azurewebsites.net" `
  SMTP_HOST="smtp-relay.brevo.com" `
  SMTP_PORT=587 `
  SMTP_SECURE=false `
  SMTP_USER="<your-brevo-smtp-user>" `
  SMTP_PASS="<your-brevo-smtp-pass>" `
  EMAIL_FROM="SecureVault <kusumakar99@gmail.com>" `
  AZURE_OPENAI_ENDPOINT="https://securevault-msfoundry-ai.cognitiveservices.azure.com" `
  AZURE_OPENAI_KEY="<azure-openai-key>" `
  AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini" `
  AZURE_OPENAI_API_VERSION="2024-10-21" `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false `
  WEBSITE_RUN_FROM_PACKAGE=0

# Set the startup command (runs Express which also serves built React)
az webapp config set --resource-group $RG --name $APP --startup-file "node server/src/index.js"

# Enable Always On (B1+ only)
az webapp config set --resource-group $RG --name $APP --always-on true
```

### 4. Create a service principal for GitHub Actions

```powershell
$SUB_ID = az account show --query id -o tsv
az ad sp create-for-rbac `
  --name "sp-securevault-github" `
  --role contributor `
  --scopes /subscriptions/$SUB_ID/resourceGroups/$RG `
  --json-auth
```

Copy the **entire JSON output** of the last command.

### 5. Add the secret to GitHub

In your GitHub repo (https://github.com/kusumakar99/securevault):

- Go to **Settings → Secrets and variables → Actions → New repository secret**
- Name: `AZURE_CREDENTIALS`
- Value: paste the JSON from step 4

### 6. Push to main

```powershell
cd C:\Users\kalthi\secure-vault
git init
git remote add origin https://github.com/kusumakar99/securevault.git
git add .
git commit -m "Initial commit: SecureVault"
git branch -M main
git push -u origin main
```

The GitHub Actions workflow at `.github/workflows/azure-deploy.yml` will build the React client, package the server, and deploy to Azure. After a few minutes your app will be live at:

**https://securevault-app.azurewebsites.net**

## Updating the app

Push to `main` — GitHub Actions redeploys automatically.

## Notes

- SQLite DB and encrypted uploads persist on the mounted Azure Files share at `/home/data`.
- App Service restarts/redeployments do **not** wipe data.
- Streaming logs: `az webapp log tail --resource-group rg-securevault --name securevault-app`
- To scale: change SKU on the plan (`az appservice plan update --sku S1 ...`).
