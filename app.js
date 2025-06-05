/**
 * PR Maintainability Checker
 *
 * A GitHub App that automatically analyzes pull requests for maintainability issues
 * and provides immediate feedback through comments.
 *
 * Features:
 * - Line of Code (LOC) analysis
 * - Number of Methods (NOM) analysis
 * - TODO/FIXME comment detection
 * - Package.json consistency check
 */

module.exports = function (app) {
  /**
   * Log important webhook events for debugging
   * Only logs pull_request and ping events to avoid noise
   */
  app.onAny(async (context) => {
    if (context.name === 'pull_request' || context.name === 'ping') {
      app.log.info(`Received ${context.name} event:`, {
        action: context.payload.action,
        pr: context.payload.pull_request?.number,
        payload: JSON.stringify(context.payload, null, 2),
      });
    }
  });

  /**
   * Handle GitHub's ping events
   * Used to verify webhook delivery and configuration
   */
  app.on('ping', async (context) => {
    app.log.info('Received ping event:', {
      payload: JSON.stringify(context.payload, null, 2),
    });
    return { status: 'ok' };
  });

  /**
   * Main PR analysis handler
   * Triggers on PR creation and updates
   * Analyzes files for maintainability issues
   */
  app.on(
    ['pull_request.opened', 'pull_request.synchronize'],
    async (context) => {
      app.log.info('Received PR event:', {
        payload: JSON.stringify(context.payload, null, 2),
      });

      // Guard clause for missing installation
      if (!context.payload.installation?.id) {
        app.log.error('❌ Missing installation ID in PR event payload', {
          payload: JSON.stringify(context.payload, null, 2),
        });
        return;
      }

      try {
        const pr = context.payload.pull_request;
        const repo = context.payload.repository;

        app.log.info(`🔍 Analyzing PR #${pr.number} in ${repo.full_name}`);

        // Use pre-authenticated octokit tied to the installation
        const octokit = context.octokit;

        // Get list of files changed in the PR
        const filesChanged = await octokit.rest.pulls.listFiles({
          owner: repo.owner.login,
          repo: repo.name,
          pull_number: pr.number,
        });

        const issues = [];
        const todoComments = [];
        let pkgJsonModified = false;
        let pkgLockModified = false;

        // Analyze each changed file
        for (const file of filesChanged.data) {
          const filename = file.filename;

          // Only analyze JavaScript/TypeScript files
          if (
            (filename.endsWith('.js') ||
              filename.endsWith('.tsx') ||
              filename.endsWith('.ts')) &&
            file.patch
          ) {
            try {
              // Get the full file content
              const fileContent = await octokit.rest.repos.getContent({
                owner: repo.owner.login,
                repo: repo.name,
                path: filename,
                ref: pr.head.sha,
              });

              // Decode the content from base64
              const content = Buffer.from(
                fileContent.data.content,
                'base64'
              ).toString();

              // Run maintainability checks
              const loc = countLines(content);
              const nom = countMethods(content);
              const todos = findTodos(content);

              app.log.info(`Analyzing ${filename}:`, {
                loc,
                nom,
                todos: todos.length,
                content: content.substring(0, 200) + '...', // Log first 200 chars
                methods:
                  content.match(
                    /(?:function\s+\w+|\w+\s*=\s*\(.*\)\s*=>|\w+\s*:\s*function|^\s*\w+\(.*\)\s*{)/gm
                  ) || [],
                todoMatches:
                  content.match(/(\/\/|#|\*)\s*(TODO|FIXME):?\s*(.*)/gi) || [],
              });

              // Check for maintainability issues
              if (loc > 200) {
                issues.push(`- \`${filename}\`: LOC = ${loc} 🔥`);
              }

              if (nom > 8) {
                issues.push(`- \`${filename}\`: Method Count = ${nom} 🧠`);
              }

              if (todos.length > 0) {
                todos.forEach((todo) =>
                  todoComments.push(`- \`${filename}\`: ${todo}`)
                );
              }
            } catch (error) {
              app.log.error(`Error analyzing ${filename}:`, error.message);
            }
          }

          // Check for package.json consistency
          if (filename === 'package.json') pkgJsonModified = true;
          if (filename === 'package-lock.json') pkgLockModified = true;
        }

        // Generate PR comment
        let body = '## 🤖 PR Maintainability Check\n\n';

        if (issues.length > 0) {
          body += '### ⚠️ Issues Detected:\n' + issues.join('\n') + '\n\n';
        } else {
          body += '✅ No major maintainability issues found.\n\n';
        }

        if (pkgJsonModified && !pkgLockModified) {
          body +=
            '⚠️ `package.json` was modified but `package-lock.json` was not. Ensure lockfile is up to date!\n\n';
        }

        if (todoComments.length > 0) {
          body +=
            '### 📝 TODO / FIXME Found:\n' +
            todoComments.join('\n') +
            '\nPlease address these before merging.\n';
        }

        // Post the comment on the PR
        await octokit.rest.issues.createComment({
          owner: repo.owner.login,
          repo: repo.name,
          issue_number: pr.number,
          body,
        });

        app.log.info(`✅ Successfully commented on PR #${pr.number}`);
      } catch (error) {
        app.log.error('❌ Error processing PR:', {
          error: error.message,
          pr: context.payload.pull_request?.number,
          repo: context.payload.repository?.full_name,
          payload: JSON.stringify(context.payload, null, 2),
        });
        throw error;
      }
    }
  );
};

/**
 * Counts non-empty lines of code in a file
 * Excludes comments and import/export statements
 * @param {string} content - The file content to analyze
 * @returns {number} The number of non-empty lines
 */
function countLines(content) {
  return content.split('\n').filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('/*') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('import ') &&
      !trimmed.startsWith('export ')
    );
  }).length;
}

/**
 * Counts the number of methods in a file
 * Detects regular functions, arrow functions, and method declarations
 * @param {string} content - The file content to analyze
 * @returns {number} The total number of methods
 */
function countMethods(content) {
  const functionRegex =
    /(?:function\s+\w+|\w+\s*=\s*\(.*\)\s*=>|\w+\s*:\s*function|^\s*\w+\(.*\)\s*{)/gm;
  const arrowFunctionRegex = /(?:const|let|var)\s+\w+\s*=\s*\(.*\)\s*=>/gm;
  const regularFunctionRegex = /function\s+\w+\s*\(.*\)\s*{/gm;

  const functionMatches = (content.match(functionRegex) || []).length;
  const arrowMatches = (content.match(arrowFunctionRegex) || []).length;
  const regularMatches = (content.match(regularFunctionRegex) || []).length;

  return functionMatches + arrowMatches + regularMatches;
}

/**
 * Finds TODO and FIXME comments in a file
 * Supports different comment styles (//, #, *)
 * @param {string} content - The file content to analyze
 * @returns {string[]} Array of found TODO/FIXME comments
 */
function findTodos(content) {
  const regex = /(\/\/|#|\*)\s*(TODO|FIXME):?\s*(.*)/gi;
  const matches = content.matchAll(regex);
  return Array.from(matches, (m) => m[0].trim());
}
