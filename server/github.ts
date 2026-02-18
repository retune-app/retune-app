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

// ============ Coordination System ============

const COORD_DIR = '.retuned/coordination';
const STATUS_PATH = `${COORD_DIR}/status.json`;
const PRIORITIES_PATH = `${COORD_DIR}/priorities.json`;
const ACK_PATH = `${COORD_DIR}/acknowledgments.json`;

interface StatusFile {
  current_work: string;
  status: 'idle' | 'in_progress' | 'completed';
  started_at: string | null;
  estimated_completion: string | null;
  blockers: string[];
}

async function getFileContent(owner: string, repo: string, path: string): Promise<{ content: any; sha: string } | null> {
  const octokit = await getGitHubClient();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if ('content' in data && typeof data.content === 'string') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content: JSON.parse(decoded), sha: data.sha };
    }
    return null;
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function commitFile(owner: string, repo: string, path: string, content: any, message: string, sha?: string) {
  const octokit = await getGitHubClient();
  const encoded = Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64');
  const params: any = {
    owner,
    repo,
    path,
    message,
    content: encoded,
  };
  if (sha) params.sha = sha;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  return data;
}

export async function initCoordination(owner: string, repo: string) {
  const results: string[] = [];

  const statusFile = await getFileContent(owner, repo, STATUS_PATH);
  if (!statusFile) {
    const initialStatus: StatusFile = {
      current_work: '',
      status: 'idle',
      started_at: null,
      estimated_completion: null,
      blockers: [],
    };
    await commitFile(owner, repo, STATUS_PATH, initialStatus, 'Initialize coordination: status.json');
    results.push('Created status.json');
  } else {
    results.push('status.json already exists');
  }

  const prioritiesFile = await getFileContent(owner, repo, PRIORITIES_PATH);
  if (!prioritiesFile) {
    const initialPriorities = {
      updated_at: null,
      priorities: [],
      notes: 'RETUNED team will populate this with daily priorities',
    };
    await commitFile(owner, repo, PRIORITIES_PATH, initialPriorities, 'Initialize coordination: priorities.json');
    results.push('Created priorities.json');
  } else {
    results.push('priorities.json already exists');
  }

  return results;
}

export async function updateStatus(
  owner: string,
  repo: string,
  update: Partial<StatusFile>
) {
  const existing = await getFileContent(owner, repo, STATUS_PATH);
  const currentStatus: StatusFile = existing?.content || {
    current_work: '',
    status: 'idle',
    started_at: null,
    estimated_completion: null,
    blockers: [],
  };

  const newStatus: StatusFile = { ...currentStatus, ...update };

  if (update.status === 'in_progress' && !update.started_at) {
    newStatus.started_at = new Date().toISOString();
  }
  if (update.status === 'completed') {
    newStatus.blockers = [];
  }
  if (update.status === 'idle') {
    newStatus.current_work = '';
    newStatus.started_at = null;
    newStatus.estimated_completion = null;
    newStatus.blockers = [];
  }

  const statusLabel = update.status || currentStatus.status;
  const commitMsg = `Update status: ${statusLabel}${update.current_work ? ` - ${update.current_work}` : ''}`;

  await commitFile(owner, repo, STATUS_PATH, newStatus, commitMsg, existing?.sha);
  return newStatus;
}

export async function addBlocker(owner: string, repo: string, blocker: string) {
  const existing = await getFileContent(owner, repo, STATUS_PATH);
  if (!existing) throw new Error('status.json not found. Run init first.');

  const status: StatusFile = existing.content;
  status.blockers.push(blocker);
  status.status = 'in_progress';

  await commitFile(owner, repo, STATUS_PATH, status, `Add blocker: ${blocker}`, existing.sha);
  return status;
}

export async function getStatus(owner: string, repo: string) {
  const result = await getFileContent(owner, repo, STATUS_PATH);
  return result?.content || null;
}

export async function getPriorities(owner: string, repo: string) {
  const result = await getFileContent(owner, repo, PRIORITIES_PATH);
  return result?.content || null;
}

export async function acknowledgePriorities(owner: string, repo: string) {
  const priorities = await getFileContent(owner, repo, PRIORITIES_PATH);
  if (!priorities) throw new Error('priorities.json not found');

  const existing = await getFileContent(owner, repo, ACK_PATH);
  const acks = existing?.content || { acknowledgments: [] };

  acks.acknowledgments.push({
    acknowledged_at: new Date().toISOString(),
    priorities_snapshot: priorities.content,
  });

  if (acks.acknowledgments.length > 20) {
    acks.acknowledgments = acks.acknowledgments.slice(-20);
  }

  await commitFile(
    owner,
    repo,
    ACK_PATH,
    acks,
    `Acknowledge priorities - ${new Date().toISOString()}`,
    existing?.sha
  );

  return { acknowledged_at: new Date().toISOString(), priorities: priorities.content };
}

// ============ Document Sharing System ============

const DOCS_DIR = '.retuned/docs';
const INBOX_DIR = '.retuned/inbox';

async function getRawFileContent(owner: string, repo: string, path: string): Promise<{ content: string; sha: string } | null> {
  const octokit = await getGitHubClient();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if ('content' in data && typeof data.content === 'string') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content: decoded, sha: data.sha };
    }
    return null;
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function commitRawFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string) {
  const octokit = await getGitHubClient();
  const encoded = Buffer.from(content).toString('base64');
  const params: any = { owner, repo, path, message, content: encoded };
  if (sha) params.sha = sha;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  return data;
}

export async function pushDocument(
  owner: string,
  repo: string,
  category: 'proposals' | 'decisions' | 'changelogs',
  filename: string,
  content: string,
  commitMessage?: string
) {
  const path = `${DOCS_DIR}/${category}/${filename}`;
  const existing = await getRawFileContent(owner, repo, path);
  const message = commitMessage || `Add ${category} doc: ${filename}`;
  await commitRawFile(owner, repo, path, content, message, existing?.sha);
  return { path, url: `https://github.com/${owner}/${repo}/blob/main/${path}` };
}

export async function pushInboxMessage(
  owner: string,
  repo: string,
  direction: 'to-agent' | 'to-team',
  filename: string,
  content: string
) {
  const path = `${INBOX_DIR}/${direction}/${filename}`;
  const existing = await getRawFileContent(owner, repo, path);
  const message = direction === 'to-team'
    ? `Agent update: ${filename}`
    : `Team message: ${filename}`;
  await commitRawFile(owner, repo, path, content, message, existing?.sha);
  return { path, url: `https://github.com/${owner}/${repo}/blob/main/${path}` };
}

export async function getInboxMessages(owner: string, repo: string, direction: 'to-agent' | 'to-team') {
  const octokit = await getGitHubClient();
  const path = `${INBOX_DIR}/${direction}`;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(data)) {
      const messages = [];
      for (const file of data) {
        if (file.type === 'file' && file.name.endsWith('.md')) {
          const content = await getRawFileContent(owner, repo, file.path);
          messages.push({ name: file.name, path: file.path, content: content?.content || '' });
        }
      }
      return messages;
    }
    return [];
  } catch (e: any) {
    if (e.status === 404) return [];
    throw e;
  }
}

export async function initDocStructure(owner: string, repo: string) {
  const results: string[] = [];

  const folders: { path: string; readme: string }[] = [
    {
      path: `${DOCS_DIR}/proposals`,
      readme: `# Proposals\n\nTechnical evaluations and proposals for team review.\n\nFiles here are pending discussion — move to \`decisions/\` once approved or rejected.\n`,
    },
    {
      path: `${DOCS_DIR}/decisions`,
      readme: `# Decisions\n\nFinalized technical decisions with outcomes.\n\nEach file should note whether the proposal was approved or rejected and why.\n`,
    },
    {
      path: `${DOCS_DIR}/changelogs`,
      readme: `# Changelogs\n\nSummaries of significant changes made to the codebase.\n\nDropped here after major features or refactors for team awareness.\n`,
    },
    {
      path: `${INBOX_DIR}/to-agent`,
      readme: `# To Agent\n\nDrop markdown files here with instructions, feedback, or questions for the Replit agent.\n\nThe agent will pick these up at the start of each session.\n`,
    },
    {
      path: `${INBOX_DIR}/to-team`,
      readme: `# To Team\n\nUpdates, summaries, and questions from the Replit agent to the team.\n\nCheck here for agent progress reports and decisions that need input.\n`,
    },
  ];

  for (const folder of folders) {
    const readmePath = `${folder.path}/README.md`;
    const existing = await getRawFileContent(owner, repo, readmePath);
    if (!existing) {
      await commitRawFile(owner, repo, readmePath, folder.readme, `Initialize ${folder.path}`);
      results.push(`Created ${readmePath}`);
    } else {
      results.push(`${readmePath} already exists`);
    }
  }

  return results;
}
