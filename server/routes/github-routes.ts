import type { Express, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import {
  postIssueComment,
  setIssueStatusLabel,
  updateProjectCard,
  getIssueNodeId,
  getAssignedIssues,
  listRepos,
  initCoordination,
  updateStatus,
  addBlocker,
  getStatus,
  getPriorities,
  acknowledgePriorities,
  initDocStructure,
  pushDocument,
  pushInboxMessage,
  getInboxMessages,
} from "../github";

export function registerGithubRoutes(app: Express): void {
  // ============ GitHub Integration Routes ============

  app.get("/api/github/repos", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const repos = await listRepos();
      res.json(repos);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch repositories" });
    }
  });

  app.get("/api/github/issues/:owner/:repo", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issues = await getAssignedIssues(owner, repo);
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch issues" });
    }
  });

  app.post("/api/github/issues/:owner/:repo/:issueNumber/comment", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issueNumber = req.params.issueNumber as string;
      const { body } = req.body;
      if (!body) {
        return res.status(400).json({ error: "Comment body is required" });
      }
      const comment = await postIssueComment(owner, repo, parseInt(issueNumber), body);
      res.json({ success: true, commentId: comment.id, url: comment.html_url });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to post comment" });
    }
  });

  app.post("/api/github/issues/:owner/:repo/:issueNumber/label", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issueNumber = req.params.issueNumber as string;
      const { status } = req.body;
      const validStatuses = ['in-progress', 'blocked', 'completed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      const result = await setIssueStatusLabel(owner, repo, parseInt(issueNumber), status);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update label" });
    }
  });

  app.post("/api/github/project/:owner/:projectNumber/move", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const projectNumber = req.params.projectNumber as string;
      const { repo, issueNumber, status } = req.body;
      if (!repo || !issueNumber || !status) {
        return res.status(400).json({ error: "repo, issueNumber, and status are required" });
      }
      const nodeId = await getIssueNodeId(owner, repo, parseInt(issueNumber));
      const result = await updateProjectCard(owner, parseInt(projectNumber), nodeId, status);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update project card" });
    }
  });

  app.post("/api/github/issues/:owner/:repo/:issueNumber/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issueNumber = req.params.issueNumber as string;
      const { status, comment, projectNumber } = req.body;
      const validStatuses = ['in-progress', 'blocked', 'completed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      const num = parseInt(issueNumber);
      const results: any = { success: true };

      const labelResult = await setIssueStatusLabel(owner, repo, num, status);
      results.label = labelResult;

      const statusMessages: Record<string, string> = {
        'in-progress': '🔄 **Status: In Progress**',
        'blocked': '🚫 **Status: Blocked**',
        'completed': '✅ **Status: Completed**',
      };
      const commentBody = comment
        ? `${statusMessages[status]}\n\n${comment}`
        : statusMessages[status];
      const commentResult = await postIssueComment(owner, repo, num, commentBody);
      results.comment = { id: commentResult.id, url: commentResult.html_url };

      if (projectNumber) {
        try {
          const nodeId = await getIssueNodeId(owner, repo, num);
          const projectResult = await updateProjectCard(owner, parseInt(projectNumber), nodeId, status);
          results.project = projectResult;
        } catch (e: any) {
          results.projectError = e.message;
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update issue status" });
    }
  });

  // ============ Coordination System Routes ============

  app.post("/api/github/coordination/:owner/:repo/init", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const results = await initCoordination(owner, repo);
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initialize coordination" });
    }
  });

  app.get("/api/github/coordination/:owner/:repo/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const status = await getStatus(owner, repo);
      if (!status) {
        return res.status(404).json({ error: "status.json not found. Run init first." });
      }
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get status" });
    }
  });

  app.post("/api/github/coordination/:owner/:repo/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const { current_work, status, estimated_completion } = req.body;
      const validStatuses = ['idle', 'in_progress', 'completed'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      const result = await updateStatus(owner, repo, { current_work, status, estimated_completion });
      res.json({ success: true, status: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update status" });
    }
  });

  app.post("/api/github/coordination/:owner/:repo/blocker", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const { blocker } = req.body;
      if (!blocker) {
        return res.status(400).json({ error: "blocker text is required" });
      }
      const result = await addBlocker(owner, repo, blocker);
      res.json({ success: true, status: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to add blocker" });
    }
  });

  app.get("/api/github/coordination/:owner/:repo/priorities", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const priorities = await getPriorities(owner, repo);
      if (!priorities) {
        return res.status(404).json({ error: "priorities.json not found. Run init first." });
      }
      res.json(priorities);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get priorities" });
    }
  });

  app.post("/api/github/coordination/:owner/:repo/acknowledge", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const result = await acknowledgePriorities(owner, repo);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to acknowledge priorities" });
    }
  });

  // ============ Document Sharing System ============

  app.post("/api/github/docs/:owner/:repo/init", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const results = await initDocStructure(owner, repo);
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initialize doc structure" });
    }
  });

  app.post("/api/github/docs/:owner/:repo/push", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const { category, filename, content, commitMessage } = req.body;
      if (!category || !filename || !content) {
        return res.status(400).json({ error: "category, filename, and content are required" });
      }
      const result = await pushDocument(owner, repo, category, filename, content, commitMessage);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to push document" });
    }
  });

  app.post("/api/github/inbox/:owner/:repo/:direction", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const direction = req.params.direction as string;
      if (direction !== 'to-agent' && direction !== 'to-team') {
        return res.status(400).json({ error: "direction must be 'to-agent' or 'to-team'" });
      }
      const { filename, content } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ error: "filename and content are required" });
      }
      const result = await pushInboxMessage(owner, repo, direction, filename, content);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to push inbox message" });
    }
  });

  app.get("/api/github/inbox/:owner/:repo/:direction", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const direction = req.params.direction as string;
      if (direction !== 'to-agent' && direction !== 'to-team') {
        return res.status(400).json({ error: "direction must be 'to-agent' or 'to-team'" });
      }
      const messages = await getInboxMessages(owner, repo, direction);
      res.json({ messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get inbox messages" });
    }
  });
}
