// GitHub Integration - Replit Connector (connection:conn_github_01KGV1YDWVJT54AGKHQNTSN7AB)
import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const STATUS_LABELS = ['in-progress', 'blocked', 'completed'] as const;
type StatusLabel = typeof STATUS_LABELS[number];

export async function postIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
) {
  const octokit = await getGitHubClient();
  const result = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  return result.data;
}

export async function setIssueStatusLabel(
  owner: string,
  repo: string,
  issueNumber: number,
  status: StatusLabel
) {
  const octokit = await getGitHubClient();

  const { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const labelsToRemove = currentLabels.filter(
    (label) => STATUS_LABELS.includes(label.name as StatusLabel) && label.name !== status
  );

  for (const label of labelsToRemove) {
    try {
      await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label.name,
      });
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }
  }

  try {
    await octokit.issues.getLabel({ owner, repo, name: status });
  } catch (e: any) {
    if (e.status === 404) {
      const colorMap: Record<StatusLabel, string> = {
        'in-progress': 'fbca04',
        'blocked': 'e11d48',
        'completed': '22c55e',
      };
      await octokit.issues.createLabel({
        owner,
        repo,
        name: status,
        color: colorMap[status],
        description: `Task is ${status}`,
      });
    } else {
      throw e;
    }
  }

  await octokit.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [status],
  });

  return { issueNumber, status };
}

export async function updateProjectCard(
  owner: string,
  projectNumber: number,
  issueNodeId: string,
  statusFieldValue: string
) {
  const octokit = await getGitHubClient();

  const projectQuery = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { id }
                ... on PullRequest { id }
              }
            }
          }
        }
      }
      organization(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { id }
                ... on PullRequest { id }
              }
            }
          }
        }
      }
    }
  `;

  const projectData: any = await octokit.graphql(projectQuery, {
    owner,
    number: projectNumber,
  });

  const project = projectData.user?.projectV2 || projectData.organization?.projectV2;
  if (!project) {
    throw new Error(`Project #${projectNumber} not found for ${owner}`);
  }

  const statusField = project.fields.nodes.find(
    (f: any) => f.name === 'Status' && f.options
  );
  if (!statusField) {
    throw new Error('Status field not found on project board');
  }

  const targetOption = statusField.options.find(
    (o: any) => o.name.toLowerCase() === statusFieldValue.toLowerCase()
  );
  if (!targetOption) {
    const available = statusField.options.map((o: any) => o.name).join(', ');
    throw new Error(`Status "${statusFieldValue}" not found. Available: ${available}`);
  }

  const item = project.items.nodes.find(
    (i: any) => i.content?.id === issueNodeId
  );
  if (!item) {
    throw new Error('Issue not found on this project board');
  }

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  `;

  await octokit.graphql(mutation, {
    projectId: project.id,
    itemId: item.id,
    fieldId: statusField.id,
    optionId: targetOption.id,
  });

  return { projectNumber, issueNodeId, status: statusFieldValue };
}

export async function getIssueNodeId(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<string> {
  const octokit = await getGitHubClient();
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;
  const result: any = await octokit.graphql(query, {
    owner,
    repo,
    number: issueNumber,
  });
  return result.repository.issue.id;
}

export async function getAssignedIssues(owner: string, repo: string) {
  const octokit = await getGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    assignee: user.login,
    state: 'open',
    per_page: 100,
  });
  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    labels: issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
    state: issue.state,
    url: issue.html_url,
  }));
}

export async function listRepos() {
  const octokit = await getGitHubClient();
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 30,
  });
  return repos.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    url: r.html_url,
  }));
}
