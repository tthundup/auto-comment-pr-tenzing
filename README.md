# PR Maintainability Checker - Local Setup Guide

A GitHub App that automatically analyzes pull requests for maintainability issues and provides feedback.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone ********
   cd auto-comment-pr-tenzing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up webhook forwarding**
   - Go to [smee.io](https://smee.io)
   - Create a new channel
   - Copy the channel URL
   - Create a `smee.js` file in your project root:
     ```javascript
     const SmeeClient = require('smee-client')

     const smee = new SmeeClient({
       source: 'https://smee.io/your-channel',
       target: 'http://localhost:3000',
       logger: console
     })

     const events = smee.start()
     ```
   - Replace `'https://smee.io/your-channel'` with your actual smee.io channel URL

4. **Create a GitHub App**
   - Go to [GitHub Apps](https://github.com/settings/apps)
   - Create new app with:
     - Name: `PR Maintainability Checker`
     - Webhook URL: Your smee.io channel URL
     - Permissions: Pull requests (Read & Write), Contents (Read)
     - Events: Pull requests

5. **Configure environment**
   Create `.env` file:
   ```env
   APP_ID=your_app_id
   PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   WEBHOOK_SECRET=your_webhook_secret
   WEBHOOK_PROXY_URL=https://smee.io/your-channel
   ```

6. **Start the app**
   ```bash
   # Terminal 1: Start webhook forwarding
   npm run smee

   # Terminal 2: Start the app
   npm start
   ```

## Testing the App

### 1. Install the App
- Go to your GitHub App settings
- Click "Install App"
- Choose a test repository

### 2. Create Test PRs

#### Test Case 1: Large File
Create a file with:
```javascript
// TODO: Refactor this
function method1() { /* 50 lines */ }
function method2() { /* 50 lines */ }
function method3() { /* 50 lines */ }
function method4() { /* 50 lines */ }
function method5() { /* 50 lines */ }
function method6() { /* 50 lines */ }
function method7() { /* 50 lines */ }
function method8() { /* 50 lines */ }
function method9() { /* 50 lines */ }
// FIXME: Add error handling
```

#### Test Case 2: Package.json Changes
1. Modify package.json:
   ```json
   {
     "dependencies": {
       "new-package": "^1.0.0"
     }
   }
   ```
2. Don't update package-lock.json

#### Test Case 3: Multiple Files
Create a PR with:
- A large JavaScript file
- A TypeScript file with TODO comments
- A React component with many methods

### Webhook Issues
- Check smee.js is running
- Verify webhook URL in GitHub App settings
- Check webhook secret matches

### App Not Responding
- Check app is running (`npm start`)
- Verify environment variables
- Check console for errors

### Installation Issues
- Verify App ID and Private Key
- Check repository permissions
- Ensure app is installed on repository

## Debugging Tips

1. **Check Webhook Delivery**
   - Watch smee.js console for incoming webhooks
   - Verify payload structure

2. **Monitor App Logs**
   - Check app console for processing logs
   - Look for error messages

3. **Verify GitHub Settings**
   - Check App permissions
   - Verify installation status
   - Review webhook deliveries in GitHub

## Dependencies

- Node.js >= 18
- npm >= 6
- probot ^12.4.0
- smee-client ^1.2.3
- dotenv ^16.5.0

## Support

For issues:
1. Check the troubleshooting guide
2. Review the console logs
3. Open an issue in the repository
