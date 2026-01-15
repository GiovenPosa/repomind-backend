import { Request, Response } from "express";
import crypto from 'crypto';
import * as dotenv from 'dotenv';dotenv.config(); // ← load env first
import { S3Client } from "@aws-sdk/client-s3";
import { getJson, s3Prefix as prefix } from "../utils/s3Util";
import type { ChunkIndex } from "../types/parser";
import { ingestRepository } from "../services/ingestService";
import { parseCommit } from "../services/parserService";
import { OpenAIEmbedder } from "../ai/adapters/openaiEmbedder";
import { embedCommit } from "../services/embedService";
import { saveCommitRow, upsertChunks, insertEmbeddings } from "../services/indexerService";
import { DEFAULT_SECTIONS } from "../types/docs";
import { generateDocsPages } from "../services/documentationService";
import { upsertPageTree, toTitleCase, normalizeSpaceKey } from "../services/confluencePublisher";

// one S3 client for the process
const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
});

// defaults you can tweak or read from env
const DEFAULT_INCLUDE = [
  "src/**",
  "README.md",
  ".github/workflows/**",
  "package.json",
  "tsconfig*.json",
  "Dockerfile",
  "scripts/**"
];
const DEFAULT_EXCLUDE = [
  "node_modules/**",
  "dist/**",
  "coverage/**",
  "**/*.map",
  "**/*.png","**/*.jpg","**/*.jpeg","**/*.gif","**/*.pdf","**/*.zip"
];

function buildCfg() {
  return {
    include: DEFAULT_INCLUDE,
    exclude: DEFAULT_EXCLUDE,
    maxFileKB: 800,
  };
}

function buildLayout(tenantId: string | undefined, owner: string, repo: string, commit: string) {
  return {
    bucket: process.env.S3_BUCKET_NAME!, 
    tenantId: tenantId ?? "default",
    owner,
    repo,
    commit
  };
}

function cleanBranch(ref?: string) {
  if (!ref) return undefined;
  return ref.replace(/^refs\/heads\//, "");
}

async function queueIngest(opts: {
  owner: string;
  repo: string;
  commit: string;
  branch?: string;
  tenantId?: string;
  installationId?: number;   // <-- add
}) {
  const { owner, repo, commit, branch, tenantId, installationId } = opts;
  console.log(`\n🚀 Starting ingestion pipeline for ${owner}/${repo} @ ${commit}`);
  console.log(`   Branch: ${branch || 'unknown'}`);
  console.log(`   Installation ID: ${installationId || 'none'}`);

  setImmediate(async () => {
    try {
      const cfg = buildCfg();

      console.log(`📥 Step 1/4: Ingesting repository ${owner}/${repo}...`);
      // 1) INGEST
      const manifest = await ingestRepository({
        owner, repo, commit, branch, cfg, s3,
        layout: buildLayout(tenantId, owner, repo, commit),
        dryRun: false, saveTarball: true,
        installationId,          
      });
      const commitSha = manifest.commit;
      console.log(`✅ Step 1/4 complete: Ingested ${owner}/${repo} @ ${commitSha}`);

      // DB: commit row
      await saveCommitRow(manifest);

      console.log(`🧩 Step 2/4: Parsing code into chunks...`);
      // 2) PARSE
      await parseCommit({
        s3,
        layout: { bucket: process.env.S3_BUCKET_NAME!, tenantId: tenantId ?? "default", owner, repo, commit: commitSha },
        writePerFileJsonl: true, modelLabel: "chunker-v0.1", targetTokensPerChunk: 1600,
      });
      console.log(`✅ Step 2/4 complete: Parsed into chunks → s3://${process.env.S3_BUCKET_NAME}/.../parse/`);

      // DB: chunk metadata
      const idxKey = `${prefix({ tenantId: tenantId ?? "default", owner, repo })}commits/${commitSha}/parse/chunks.index.json`;      const index = await getJson<ChunkIndex>(s3, process.env.S3_BUCKET_NAME!, idxKey);
      await upsertChunks(owner, repo, commitSha, index.chunks);

      console.log(`🧠 Step 3/4: Generating embeddings...`);
      // 3) EMBED → S3 + DB
      if (!process.env.OPENAI_API_KEY) {
        console.warn("⚠️ Skipping embeddings: OPENAI_API_KEY is not set.");
        return;
      }
      const embedder = new OpenAIEmbedder({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
      });

      const embedResult = await embedCommit({
        s3,
        layout: { bucket: process.env.S3_BUCKET_NAME!, tenantId: tenantId ?? "default", owner, repo, commit: commitSha },
        embedder,
        batchSize: 64,
        partSize: 2000,
        onBatchVectors: async (rows) => {
          await insertEmbeddings(embedder.name, embedder.dim, rows);
        },
      });

      console.log(`✅ Step 3/4 complete: Generated ${embedResult.total} embedding vectors (provider=${embedResult.provider})`);

      console.log(`📚 Step 4/4: Generating documentation pages...`);
     // 4) DOCS → generate in memory and publish to Confluence
      try {
        if (!process.env.OPENAI_API_KEY) {
          console.warn("⚠️ Skipping docs generation: OPENAI_API_KEY is not set.");
        } else {
          const pages = await generateDocsPages({
            owner,
            repo,
            commit: commitSha,
            tenantId: tenantId ?? "default",
            bucket: process.env.S3_BUCKET_NAME,
            sections: DEFAULT_SECTIONS,
          });

          // Build a stable per-repo space key (no .env override needed)
          const rawSpaceKey = `${owner}_${repo}`;
          const spaceKey = normalizeSpaceKey(rawSpaceKey);

          console.log(`✅ Generated ${pages.length} documentation pages`);
          console.log(`📤 Publishing to Confluence...`);
          console.log("   • base:", process.env.CONFLUENCE_BASE_URL);
          console.log("   • spaceKey:", spaceKey);
          console.log("   • spaceName:", `${toTitleCase(repo)} Docs`);
          console.log("   • rootTitle:", "Code Base Documentation");
          console.log("   • pageCount:", pages.length);

          const publishResult = await upsertPageTree({
            spaceKey,
            spaceName: `${toTitleCase(repo)} Docs`,
            spaceDesc: `RepoMind automated docs for ${owner}/${repo} @ ${commitSha}`,
            rootTitle: "Code Base Documentation",
            pages,
          },
          {
            deleteMissing: true,          // ✅ turn on cleanup
            ignoreTitles: [],             // (optional) add titles you never want deleted
            dryRun: false,                // set true to see logs first without changes
          }
        );

          console.log("✅ Step 4/4 complete: Published to Confluence successfully! 🎉");
          console.log("   • Space ID:", publishResult.spaceId);
          console.log("   • Root Page ID:", publishResult.rootId);
          console.log("   • Repository:", `${owner}/${repo}`);
          console.log("   • Commit:", commitSha);
          console.log(`\n✨ Full pipeline complete for ${owner}/${repo} @ ${commitSha}\n`);
        }
      } catch (e: any) {
        // Detailed Axios error logging for fast diagnosis
        const status = e?.response?.status;
        const data   = e?.response?.data;
        console.error("Docs generation/publish failed:", {
          message: e?.message,
          status,
          data,
        });
      }

    } catch (err) {
      console.error(`❌ Ingest/Parse/Embed/Publish failed for ${owner}/${repo} @ ${commit}`, err);
    }
  });
}

// Interface for repository event
interface RepositoryEvent {
  action: 'created' | 'deleted' | 'archived' | 'unarchived' | 'renamed' | 'transferred' | 'publicized' | 'privatized';
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    description?: string;
    created_at: string;
    updated_at: string;
    default_branch: string;
    owner: {
      login: string;
      id: number;
    };
  };
  sender: {
    login: string;
    id: number;
  };
   installation?: {
    id: number;
  };
}

export class GitHubController {
  // Store new repositories in memory (use database in production)
  private static newRepositories: any[] = [];
  private static webhookEvents: any[] = [];

  static async getUserRepose(req: Request, res: Response) {
    try {
      res.json({
        message: "Get user repos endpoint",
        status: "Not implemented yet"
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch repositories",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async handleWebhook(
    req: Request & { rawBody?: Buffer; body?: any },
    res: Response
  ) {
    try {
      const eventType  = req.headers['x-github-event'] as string;
      const signature  = (req.headers['x-hub-signature-256'] as string) || '';
      const deliveryId = req.headers['x-github-delivery'] as string;

      // Use raw bytes for HMAC (fallback to JSON string if not present)
      const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));

      if (process.env.GITHUB_WEBHOOK_SECRET) {
        const isValid = GitHubController.verifyWebhookSignature(
          raw,
          signature,
          process.env.GITHUB_WEBHOOK_SECRET
        );
        if (!isValid) {
          console.error('❌ Invalid webhook signature!', { deliveryId, eventType });
          return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('✅ Webhook signature verified successfully');
      } else {
        console.warn('⚠️  No webhook secret configured - skipping verification');
      }

      console.log('\n🔔 GitHub Webhook Received:');
      console.log('┌─────────────────────────────────────');
      console.log('│ Event Type:', eventType);
      console.log('│ Delivery ID:', deliveryId);
      console.log('│ Timestamp:', new Date().toISOString());
      console.log('│ From App:', process.env.GITHUB_APP_ID);
      console.log('└─────────────────────────────────────');

      // If body is still a Buffer (e.g., when using express.raw), parse it now
      const payload: any = Buffer.isBuffer((req as any).body)
        ? JSON.parse((req as any).body.toString('utf8'))
        : req.body;

      // Store webhook event
      GitHubController.webhookEvents.push({
        eventType,
        deliveryId,
        timestamp: new Date().toISOString(),
        payload
      });

      // Process events
      switch (eventType) {
        case 'ping':
          GitHubController.handlePingEvent(payload);
          break;

        case 'repository':
          await GitHubController.handleRepositoryEvent(payload as RepositoryEvent);
          break;

        case 'push':
          GitHubController.handlePushEvent(payload);
          break;

        case 'pull_request':
          GitHubController.handlePullRequestEvent(payload);
          break;

        case 'issues':
          GitHubController.handleIssuesEvent(payload);
          break;

        case 'star':
          GitHubController.handleStarEvent(payload);
          break;

        case 'fork':
          GitHubController.handleForkEvent(payload);
          break;

        case 'installation':
          console.log('🔧 Installation event:', payload.action);
          break;

        case 'installation_repositories':
          console.log('📦 Installation repositories changed:', payload.action);
          break;

        default:
          console.log(`📌 Unhandled event type: ${eventType}`);
      }

      return res.status(200).json({
        message: 'Webhook received successfully',
        eventType,
        deliveryId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return res.status(500).json({
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get webhook status for debugging
   */
  static async getWebhookStatus(req: Request, res: Response) {
    try {
      const recentEvents = GitHubController.webhookEvents.slice(-5).map(e => ({
        type: e.eventType,
        deliveryId: e.deliveryId,
        timestamp: e.timestamp
      }));

      res.json({
        status: 'active',
        endpoint: `${req.protocol}://${req.get('host')}/api/github/webhook`,
        appId: process.env.GITHUB_APP_ID,
        eventsConfigured: [
          'repository (NEW REPO DETECTION)',
          'ping',
          'push',
          'pull_request',
          'issues',
          'star',
          'fork',
          'installation'
        ],
        secretConfigured: !!process.env.GITHUB_WEBHOOK_SECRET,
        totalEventsReceived: GitHubController.webhookEvents.length,
        recentEvents,
        newReposDetected: GitHubController.newRepositories.length,
        lastNewRepo: GitHubController.newRepositories[GitHubController.newRepositories.length - 1] || null
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get webhook status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get list of newly created repositories
   */
  static async getNewRepositories(req: Request, res: Response) {
    try {
      res.json({
        count: GitHubController.newRepositories.length,
        repositories: GitHubController.newRepositories,
        message: 'Repositories detected since server started'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get new repositories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Verify webhook signature from GitHub
   */
  static verifyWebhookSignature(payload: Buffer, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader || !secret) {
      console.warn('⚠️  Webhook signature or secret missing', { hasHeader: !!signatureHeader, hasSecret: !!secret });
      return false;
    }
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    try {
      const a = Buffer.from(signatureHeader, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch (err) {
      console.error('Signature verification error:', err);
      return false;
    }
  }

  // Event-specific handlers
  private static handlePingEvent(payload: any) {
    console.log('\n✅ WEBHOOK PING SUCCESSFUL!');
    console.log('┌─────────────────────────────────────');
    console.log('│ Hook ID:', payload.hook?.id || payload.hook_id);
    console.log('│ App ID:', payload.hook?.app_id);
    console.log('│ Zen:', payload.zen);
    if (payload.repository) {
      console.log('│ Repository:', payload.repository.full_name);
      console.log('│ Sender:', payload.sender?.login);
    }
    console.log('└─────────────────────────────────────');
    console.log('\n🎉 Your GitHub App webhook is working!\n');
  }

  private static async handleRepositoryEvent(payload: RepositoryEvent) {
    console.log('\n📚 REPOSITORY Event:');
    console.log('   Action:', payload.action);
    console.log('   Repository:', payload.repository?.full_name);
    console.log('   Private:', payload.repository?.private ? 'Yes' : 'No');
    console.log('   Owner:', payload.repository?.owner?.login);
    
    // NEW REPOSITORY CREATED - ingest initial snapshot off default branch (if any)
    if (payload.action === 'created') {
      console.log('\n');
      console.log('╔════════════════════════════════════════╗');
      console.log('║    🎉 NEW REPOSITORY DETECTED! 🎉      ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
      console.log('📋 Repository Details:');
      console.log('┌─────────────────────────────────────');
      console.log('│ Name:', payload.repository.name);
      console.log('│ Full Name:', payload.repository.full_name);
      console.log('│ Private:', payload.repository.private ? '🔒 Yes' : '🌍 No');
      console.log('│ Description:', payload.repository.description || 'No description');
      console.log('│ Default Branch:', payload.repository.default_branch);
      console.log('│ Created At:', new Date(payload.repository.created_at).toLocaleString());
      console.log('│ Owner:', payload.repository.owner.login);
      console.log('│ Created By:', payload.sender.login);
      console.log('└─────────────────────────────────────');

      const newRepo = {
        id: payload.repository.id,
        name: payload.repository.name,
        fullName: payload.repository.full_name,
        private: payload.repository.private,
        description: payload.repository.description,
        createdAt: payload.repository.created_at,
        detectedAt: new Date().toISOString(),
        owner: payload.repository.owner.login,
        createdBy: payload.sender.login,
        defaultBranch: payload.repository.default_branch
      };
      GitHubController.newRepositories.push(newRepo);
      console.log('\n✅ Repository added to tracking system');

      // Kick off an initial ingest (if repo has a default branch / content)

      try {
        const owner = payload.repository.owner.login;
        const repo = payload.repository.name;
        const defaultBranch = payload.repository.default_branch || "main";
        const installationId = payload.installation?.id;
        queueIngest({
          owner,
          repo,
          commit: defaultBranch,
          branch: defaultBranch,
          installationId,
        });
      } catch (e) {
        console.warn("⚠️ Initial ingest attempt failed (likely empty repo):", e instanceof Error ? e.message : e);
      }
    }

    // Handle other repository actions
    switch(payload.action) {
      case 'deleted':
        console.log('   ❌ Repository was DELETED');
        break;
      case 'archived':
        console.log('   📦 Repository was ARCHIVED');
        break;
      case 'unarchived':
        console.log('   📂 Repository was UNARCHIVED');
        break;
      case 'renamed':
        console.log('   ✏️  Repository was RENAMED');
        break;
      case 'transferred':
        console.log('   ➡️  Repository was TRANSFERRED');
        break;
      case 'publicized':
        console.log('   🌍 Repository was made PUBLIC');
        break;
      case 'privatized':
        console.log('   🔒 Repository was made PRIVATE');
        break;
    }
  }

  private static handlePushEvent(payload: any) {
    console.log('📦 PUSH Event:');
    console.log('   Repository:', payload.repository?.full_name);
    console.log('   Branch:', payload.ref?.replace('refs/heads/', ''));
    console.log('   Pusher:', payload.pusher?.name);
    console.log('   Commits:', payload.commits?.length || 0);
    
    // Log each commit (first 3)
    payload.commits?.slice(0, 3).forEach((commit: any, index: number) => {
      console.log(`   Commit ${index + 1}:`, commit.message.split('\n')[0]);
      console.log(`     Author: ${commit.author?.name}`);
      console.log(`     SHA: ${commit.id?.substring(0, 7)}`);
    });

    // Kick ingest for head commit
    try {
      const owner = payload.repository?.owner?.name || payload.repository?.owner?.login;
      const repo  = payload.repository?.name;
      const commitSha = payload.after || payload.head_commit?.id; // head SHA
      const branch = cleanBranch(payload.ref); // "main"
      const installationId = payload.installation?.id;

      if (!owner || !repo || !commitSha) {
        console.warn('⚠️ Missing owner/repo/commitSha in push payload; skipping ingest.');
        return;
      }

      queueIngest({
        owner,
        repo,
        commit: commitSha,
        branch,
        tenantId: undefined,
        installationId,         
      });
    } catch (e) {
      console.error('❌ Failed to queue ingest for push:', e);
    }
  }

  private static handlePullRequestEvent(payload: any) {
    console.log('🔀 PULL REQUEST Event:');
    console.log('   Action:', payload.action);
    console.log('   PR #:', payload.pull_request?.number);
    console.log('   Title:', payload.pull_request?.title);
    console.log('   Author:', payload.pull_request?.user?.login);
    console.log('   Base:', payload.pull_request?.base?.ref);
    console.log('   Head:', payload.pull_request?.head?.ref);
    console.log('   State:', payload.pull_request?.state);
  }

  private static handleIssuesEvent(payload: any) {
    console.log('📝 ISSUES Event:');
    console.log('   Action:', payload.action);
    console.log('   Issue #:', payload.issue?.number);
    console.log('   Title:', payload.issue?.title);
    console.log('   Author:', payload.issue?.user?.login);
    console.log('   State:', payload.issue?.state);
    console.log('   Labels:', payload.issue?.labels?.map((l: any) => l.name).join(', '));
  }

  private static handleStarEvent(payload: any) {
    console.log('⭐ STAR Event:');
    console.log('   Action:', payload.action);
    console.log('   Repository:', payload.repository?.full_name);
    console.log('   Stars Count:', payload.repository?.stargazers_count);
    console.log('   Starred by:', payload.sender?.login);
  }

  private static handleForkEvent(payload: any) {
    console.log('🍴 FORK Event:');
    console.log('   Repository:', payload.repository?.full_name);
    console.log('   Forks Count:', payload.repository?.forks_count);
    console.log('   Forked by:', payload.sender?.login);
    console.log('   Fork Name:', payload.forkee?.full_name);
  }
}

export default GitHubController;