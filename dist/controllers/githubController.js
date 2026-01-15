"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dotenv = __importStar(require("dotenv"));
dotenv.config(); // ← load env first
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Util_1 = require("../utils/s3Util");
const ingestService_1 = require("../services/ingestService");
const parserService_1 = require("../services/parserService");
const openaiEmbedder_1 = require("../ai/adapters/openaiEmbedder");
const embedService_1 = require("../services/embedService");
const indexerService_1 = require("../services/indexerService");
const docs_1 = require("../types/docs");
const documentationService_1 = require("../services/documentationService");
const confluencePublisher_1 = require("../services/confluencePublisher");
// one S3 client for the process
const s3 = new client_s3_1.S3Client({
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
    "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.gif", "**/*.pdf", "**/*.zip"
];
function buildCfg() {
    return {
        include: DEFAULT_INCLUDE,
        exclude: DEFAULT_EXCLUDE,
        maxFileKB: 800,
    };
}
function buildLayout(tenantId, owner, repo, commit) {
    return {
        bucket: process.env.S3_BUCKET_NAME,
        tenantId: tenantId ?? "default",
        owner,
        repo,
        commit
    };
}
function cleanBranch(ref) {
    if (!ref)
        return undefined;
    return ref.replace(/^refs\/heads\//, "");
}
async function queueIngest(opts) {
    const { owner, repo, commit, branch, tenantId, installationId } = opts;
    console.log(`\n🚀 Starting ingestion pipeline for ${owner}/${repo} @ ${commit}`);
    console.log(`   Branch: ${branch || 'unknown'}`);
    console.log(`   Installation ID: ${installationId || 'none'}`);
    setImmediate(async () => {
        try {
            const cfg = buildCfg();
            console.log(`📥 Step 1/4: Ingesting repository ${owner}/${repo}...`);
            // 1) INGEST
            const manifest = await (0, ingestService_1.ingestRepository)({
                owner, repo, commit, branch, cfg, s3,
                layout: buildLayout(tenantId, owner, repo, commit),
                dryRun: false, saveTarball: true,
                installationId,
            });
            const commitSha = manifest.commit;
            console.log(`✅ Step 1/4 complete: Ingested ${owner}/${repo} @ ${commitSha}`);
            // DB: commit row
            await (0, indexerService_1.saveCommitRow)(manifest);
            console.log(`🧩 Step 2/4: Parsing code into chunks...`);
            // 2) PARSE
            await (0, parserService_1.parseCommit)({
                s3,
                layout: { bucket: process.env.S3_BUCKET_NAME, tenantId: tenantId ?? "default", owner, repo, commit: commitSha },
                writePerFileJsonl: true, modelLabel: "chunker-v0.1", targetTokensPerChunk: 1600,
            });
            console.log(`✅ Step 2/4 complete: Parsed into chunks → s3://${process.env.S3_BUCKET_NAME}/.../parse/`);
            // DB: chunk metadata
            const idxKey = `${(0, s3Util_1.s3Prefix)({ tenantId: tenantId ?? "default", owner, repo })}commits/${commitSha}/parse/chunks.index.json`;
            const index = await (0, s3Util_1.getJson)(s3, process.env.S3_BUCKET_NAME, idxKey);
            await (0, indexerService_1.upsertChunks)(owner, repo, commitSha, index.chunks);
            console.log(`🧠 Step 3/4: Generating embeddings...`);
            // 3) EMBED → S3 + DB
            if (!process.env.OPENAI_API_KEY) {
                console.warn("⚠️ Skipping embeddings: OPENAI_API_KEY is not set.");
                return;
            }
            const embedder = new openaiEmbedder_1.OpenAIEmbedder({
                apiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
            });
            const embedResult = await (0, embedService_1.embedCommit)({
                s3,
                layout: { bucket: process.env.S3_BUCKET_NAME, tenantId: tenantId ?? "default", owner, repo, commit: commitSha },
                embedder,
                batchSize: 64,
                partSize: 2000,
                onBatchVectors: async (rows) => {
                    await (0, indexerService_1.insertEmbeddings)(embedder.name, embedder.dim, rows);
                },
            });
            console.log(`✅ Step 3/4 complete: Generated ${embedResult.total} embedding vectors (provider=${embedResult.provider})`);
            console.log(`📚 Step 4/4: Generating documentation pages...`);
            // 4) DOCS → generate in memory and publish to Confluence
            try {
                if (!process.env.OPENAI_API_KEY) {
                    console.warn("⚠️ Skipping docs generation: OPENAI_API_KEY is not set.");
                }
                else {
                    const pages = await (0, documentationService_1.generateDocsPages)({
                        owner,
                        repo,
                        commit: commitSha,
                        tenantId: tenantId ?? "default",
                        bucket: process.env.S3_BUCKET_NAME,
                        sections: docs_1.DEFAULT_SECTIONS,
                    });
                    // Build a stable per-repo space key (no .env override needed)
                    const rawSpaceKey = `${owner}_${repo}`;
                    const spaceKey = (0, confluencePublisher_1.normalizeSpaceKey)(rawSpaceKey);
                    console.log(`✅ Generated ${pages.length} documentation pages`);
                    console.log(`📤 Publishing to Confluence...`);
                    console.log("   • base:", process.env.CONFLUENCE_BASE_URL);
                    console.log("   • spaceKey:", spaceKey);
                    console.log("   • spaceName:", `${(0, confluencePublisher_1.toTitleCase)(repo)} Docs`);
                    console.log("   • rootTitle:", "Code Base Documentation");
                    console.log("   • pageCount:", pages.length);
                    const publishResult = await (0, confluencePublisher_1.upsertPageTree)({
                        spaceKey,
                        spaceName: `${(0, confluencePublisher_1.toTitleCase)(repo)} Docs`,
                        spaceDesc: `RepoMind automated docs for ${owner}/${repo} @ ${commitSha}`,
                        rootTitle: "Code Base Documentation",
                        pages,
                    }, {
                        deleteMissing: true,
                        ignoreTitles: [],
                        dryRun: false, // set true to see logs first without changes
                    });
                    console.log("✅ Step 4/4 complete: Published to Confluence successfully! 🎉");
                    console.log("   • Space ID:", publishResult.spaceId);
                    console.log("   • Root Page ID:", publishResult.rootId);
                    console.log("   • Repository:", `${owner}/${repo}`);
                    console.log("   • Commit:", commitSha);
                    console.log(`\n✨ Full pipeline complete for ${owner}/${repo} @ ${commitSha}\n`);
                }
            }
            catch (e) {
                // Detailed Axios error logging for fast diagnosis
                const status = e?.response?.status;
                const data = e?.response?.data;
                console.error("Docs generation/publish failed:", {
                    message: e?.message,
                    status,
                    data,
                });
            }
        }
        catch (err) {
            console.error(`❌ Ingest/Parse/Embed/Publish failed for ${owner}/${repo} @ ${commit}`, err);
        }
    });
}
class GitHubController {
    static async getUserRepose(req, res) {
        try {
            res.json({
                message: "Get user repos endpoint",
                status: "Not implemented yet"
            });
        }
        catch (error) {
            res.status(500).json({
                error: "Failed to fetch repositories",
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    static async handleWebhook(req, res) {
        try {
            const eventType = req.headers['x-github-event'];
            const signature = req.headers['x-hub-signature-256'] || '';
            const deliveryId = req.headers['x-github-delivery'];
            // Use raw bytes for HMAC (fallback to JSON string if not present)
            const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
            if (process.env.GITHUB_WEBHOOK_SECRET) {
                const isValid = GitHubController.verifyWebhookSignature(raw, signature, process.env.GITHUB_WEBHOOK_SECRET);
                if (!isValid) {
                    console.error('❌ Invalid webhook signature!', { deliveryId, eventType });
                    return res.status(401).json({ error: 'Invalid signature' });
                }
                console.log('✅ Webhook signature verified successfully');
            }
            else {
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
            const payload = Buffer.isBuffer(req.body)
                ? JSON.parse(req.body.toString('utf8'))
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
                    await GitHubController.handleRepositoryEvent(payload);
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
        }
        catch (error) {
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
    static async getWebhookStatus(req, res) {
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
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get webhook status',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Get list of newly created repositories
     */
    static async getNewRepositories(req, res) {
        try {
            res.json({
                count: GitHubController.newRepositories.length,
                repositories: GitHubController.newRepositories,
                message: 'Repositories detected since server started'
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get new repositories',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Verify webhook signature from GitHub
     */
    static verifyWebhookSignature(payload, signatureHeader, secret) {
        if (!signatureHeader || !secret) {
            console.warn('⚠️  Webhook signature or secret missing', { hasHeader: !!signatureHeader, hasSecret: !!secret });
            return false;
        }
        const expected = 'sha256=' + crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
        try {
            const a = Buffer.from(signatureHeader, 'utf8');
            const b = Buffer.from(expected, 'utf8');
            if (a.length !== b.length)
                return false;
            return crypto_1.default.timingSafeEqual(a, b);
        }
        catch (err) {
            console.error('Signature verification error:', err);
            return false;
        }
    }
    // Event-specific handlers
    static handlePingEvent(payload) {
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
    static async handleRepositoryEvent(payload) {
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
            }
            catch (e) {
                console.warn("⚠️ Initial ingest attempt failed (likely empty repo):", e instanceof Error ? e.message : e);
            }
        }
        // Handle other repository actions
        switch (payload.action) {
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
    static handlePushEvent(payload) {
        console.log('📦 PUSH Event:');
        console.log('   Repository:', payload.repository?.full_name);
        console.log('   Branch:', payload.ref?.replace('refs/heads/', ''));
        console.log('   Pusher:', payload.pusher?.name);
        console.log('   Commits:', payload.commits?.length || 0);
        // Log each commit (first 3)
        payload.commits?.slice(0, 3).forEach((commit, index) => {
            console.log(`   Commit ${index + 1}:`, commit.message.split('\n')[0]);
            console.log(`     Author: ${commit.author?.name}`);
            console.log(`     SHA: ${commit.id?.substring(0, 7)}`);
        });
        // Kick ingest for head commit
        try {
            const owner = payload.repository?.owner?.name || payload.repository?.owner?.login;
            const repo = payload.repository?.name;
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
        }
        catch (e) {
            console.error('❌ Failed to queue ingest for push:', e);
        }
    }
    static handlePullRequestEvent(payload) {
        console.log('🔀 PULL REQUEST Event:');
        console.log('   Action:', payload.action);
        console.log('   PR #:', payload.pull_request?.number);
        console.log('   Title:', payload.pull_request?.title);
        console.log('   Author:', payload.pull_request?.user?.login);
        console.log('   Base:', payload.pull_request?.base?.ref);
        console.log('   Head:', payload.pull_request?.head?.ref);
        console.log('   State:', payload.pull_request?.state);
    }
    static handleIssuesEvent(payload) {
        console.log('📝 ISSUES Event:');
        console.log('   Action:', payload.action);
        console.log('   Issue #:', payload.issue?.number);
        console.log('   Title:', payload.issue?.title);
        console.log('   Author:', payload.issue?.user?.login);
        console.log('   State:', payload.issue?.state);
        console.log('   Labels:', payload.issue?.labels?.map((l) => l.name).join(', '));
    }
    static handleStarEvent(payload) {
        console.log('⭐ STAR Event:');
        console.log('   Action:', payload.action);
        console.log('   Repository:', payload.repository?.full_name);
        console.log('   Stars Count:', payload.repository?.stargazers_count);
        console.log('   Starred by:', payload.sender?.login);
    }
    static handleForkEvent(payload) {
        console.log('🍴 FORK Event:');
        console.log('   Repository:', payload.repository?.full_name);
        console.log('   Forks Count:', payload.repository?.forks_count);
        console.log('   Forked by:', payload.sender?.login);
        console.log('   Fork Name:', payload.forkee?.full_name);
    }
}
exports.GitHubController = GitHubController;
// Store new repositories in memory (use database in production)
GitHubController.newRepositories = [];
GitHubController.webhookEvents = [];
exports.default = GitHubController;
