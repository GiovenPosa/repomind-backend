import { Request, Response } from "express";
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
}

export class GitHubController {
  // Store new repositories in memory (use database in production)
  private static newRepositories: any[] = [];
  private static webhookEvents: any[] = [];

  static async getUserRepose(req: Request, res: Response) {
    try {
      // TODO: Implement fetching user repositories
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

  static async handleWebhook(req: Request, res: Response) {
    try {
      // Get webhook headers
      const eventType = req.headers['x-github-event'] as string;
      const signature = req.headers['x-hub-signature-256'] as string;
      const deliveryId = req.headers['x-github-delivery'] as string;
      
      // Verify webhook signature if secret is configured
      if (process.env.GITHUB_WEBHOOK_SECRET) {
        const isValid = GitHubController.verifyWebhookSignature(
          JSON.stringify(req.body),
          signature,
          process.env.GITHUB_WEBHOOK_SECRET
        );
        
        if (!isValid) {
          console.error('❌ Invalid webhook signature!');
          console.error('   Expected signature:', signature);
          console.error('   Secret configured:', !!process.env.GITHUB_WEBHOOK_SECRET);
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
      
      // Store webhook event
      const webhookEvent = {
        eventType,
        deliveryId,
        timestamp: new Date().toISOString(),
        payload: req.body
      };
      GitHubController.webhookEvents.push(webhookEvent);
      
      // Get the payload
      const payload = req.body;
      
      // Process different event types
      switch(eventType) {
        case 'ping':
          GitHubController.handlePingEvent(payload);
          break;
          
        case 'repository':
          // IMPORTANT: This is where new repos are detected!
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
      
      // Send success response to GitHub
      res.status(200).json({
        message: 'Webhook received successfully',
        eventType,
        deliveryId,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({
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
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      console.warn('⚠️  Webhook signature or secret missing');
      console.log('   Signature present:', !!signature);
      console.log('   Secret present:', !!secret);
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signature)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
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
    
    // NEW REPOSITORY CREATED - This is what we're looking for!
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
      
      // Store the new repository
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
      console.log(`📊 Total new repositories tracked: ${GitHubController.newRepositories.length}`);
      
      // TODO: Automated actions when new repo is created:
      console.log('\n🤖 Automated actions to implement:');
      console.log('   [ ] Clone repository locally');
      console.log('   [ ] Initialize with README template');
      console.log('   [ ] Add default labels');
      console.log('   [ ] Set up branch protection');
      console.log('   [ ] Configure GitHub Actions');
      console.log('   [ ] Send notification to Slack/Discord');
      console.log('   [ ] Add to project board');
      console.log('\n');
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
    
    // Log each commit
    payload.commits?.slice(0, 3).forEach((commit: any, index: number) => {
      console.log(`   Commit ${index + 1}:`, commit.message.split('\n')[0]);
      console.log(`     Author: ${commit.author?.name}`);
      console.log(`     SHA: ${commit.id?.substring(0, 7)}`);
    });
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