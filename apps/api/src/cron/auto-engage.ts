import Anthropic from '@anthropic-ai/sdk';
import type { Core } from '@strapi/strapi';

const BATCH_SIZE = parseInt(process.env.CRON_POSTS_PER_RUN ?? '5', 10);
const MAX_IMAGES = 5;

// ── Tiptap node types ────────────────────────────────────────────────────────

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

type AnthropicContentBlock =
  | Anthropic.TextBlockParam
  | Anthropic.ImageBlockParam;

/**
 * Recursively walk Tiptap JSON and collect text + image content blocks.
 * Videos are represented as "[video]" text since Claude cannot process them.
 */
function buildContentBlocks(
  node: TiptapNode,
  imageCount: { value: number }
): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];

  if (!node) return blocks;

  if (node.type === 'text' && node.text) {
    blocks.push({ type: 'text', text: node.text });
    return blocks;
  }

  if (node.type === 'image' && imageCount.value < MAX_IMAGES) {
    const src = node.attrs?.src as string | undefined;
    if (src?.startsWith('https://')) {
      blocks.push({
        type: 'image',
        source: { type: 'url', url: src },
      });
      imageCount.value++;
    }
    return blocks;
  }

  if (node.type === 'video') {
    blocks.push({ type: 'text', text: '[video]' });
    return blocks;
  }

  if (node.content) {
    for (const child of node.content) {
      blocks.push(...buildContentBlocks(child, imageCount));
    }
  }

  return blocks;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function autoEngage(strapi: Core.Strapi) {
  const log = (msg: string) => console.log(`[cron:autoEngage] ${msg}`);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log('ANTHROPIC_API_KEY not set — skipping.');
    return;
  }

  // 1. Load seeded users
  const seededUsers = (await strapi.db
    .query('plugin::users-permissions.user')
    .findMany({
      where: { isSeeded: true, blocked: false, confirmed: true },
      limit: 200,
    })) as Array<{ id: number; documentId: string; username: string; email: string }>;

  if (!seededUsers.length) {
    log('No seeded users (isSeeded=true) found — skipping.');
    return;
  }

  // 2. Cursor-based offset
  const store = strapi.store({ type: 'core', name: 'cron', key: 'autoEngageOffset' });
  const currentOffset = ((await store.get({})) as number) ?? 0;

  const posts = (await strapi.db.query('api::post.post').findMany({
    where: { publishedAt: { $notNull: true } },
    populate: ['author', 'images'],
    orderBy: { createdAt: 'asc' },
    limit: BATCH_SIZE,
    offset: currentOffset,
  })) as Array<{
    id: number;
    documentId: string;
    title: string;
    content: TiptapNode;
    images: Array<{ url: string }>;
    author?: { id: number; documentId: string; username: string };
  }>;

  const nextOffset = posts.length < BATCH_SIZE ? 0 : currentOffset + BATCH_SIZE;
  await store.set({ value: nextOffset });
  log(`Processing ${posts.length} posts (offset ${currentOffset} → ${nextOffset})`);

  if (!posts.length) {
    log('No published posts found.');
    return;
  }

  const anthropic = new Anthropic({ apiKey });

  for (const post of posts) {
    try {
      await engagePost(strapi, anthropic, post, seededUsers, log);
    } catch (err) {
      log(`Error on post ${post.documentId}: ${err}`);
    }
  }
}

async function engagePost(
  strapi: Core.Strapi,
  anthropic: Anthropic,
  post: {
    id: number;
    documentId: string;
    title: string;
    content: TiptapNode;
    images: Array<{ url: string }>;
    author?: { id: number; documentId: string; username: string };
  },
  seededUsers: Array<{ id: number; documentId: string; username: string; email: string }>,
  log: (msg: string) => void
) {
  // Pick actor ≠ post author
  const candidates = seededUsers.filter((u) => u.id !== post.author?.id);
  if (!candidates.length) return;
  const actor = pickRandom(candidates);

  // Fetch existing comments for branching decision
  const existingComments = (await strapi.db.query('api::comment.comment').findMany({
    where: { targetType: 'post', targetDocumentId: post.documentId },
    limit: 50,
  })) as Array<{ id: number; documentId: string; authorName: string; content: string }>;

  const shouldReply =
    existingComments.length > 0 && Math.random() < 0.5;

  const parentComment = shouldReply ? pickRandom(existingComments) : null;

  // Generate comment via Anthropic
  const generatedComment = await generateComment(
    anthropic,
    post,
    parentComment
  );

  if (!generatedComment) {
    log(`Skipped comment for post ${post.documentId} — empty AI response`);
  } else {
    const commentData: Record<string, unknown> = {
      authorName: actor.username,
      authorEmail: actor.email,
      content: generatedComment,
      targetType: 'post',
      targetDocumentId: post.documentId,
    };

    if (parentComment) {
      commentData.parent = parentComment.id;
    }

    await strapi.db.query('api::comment.comment').create({ data: commentData });
    log(
      `Commented on post ${post.documentId} as "${actor.username}"${parentComment ? ' (reply)' : ''}`
    );
  }

  // Auto like
  const alreadyLiked = await strapi.db.query('api::interaction.interaction').findOne({
    where: {
      actionType: 'like',
      targetType: 'post',
      targetDocumentId: post.documentId,
      user: actor.id,
    },
  });

  if (!alreadyLiked) {
    await strapi.db.query('api::interaction.interaction').create({
      data: {
        actionType: 'like',
        targetType: 'post',
        targetDocumentId: post.documentId,
        user: actor.id,
      },
    });
    log(`Liked post ${post.documentId} as "${actor.username}"`);
  }

  // Auto follow author
  if (post.author && post.author.id !== actor.id) {
    const alreadyFollowed = await strapi.db
      .query('api::interaction.interaction')
      .findOne({
        where: {
          actionType: 'follow',
          targetType: 'user',
          targetDocumentId: post.author.documentId,
          user: actor.id,
        },
      });

    if (!alreadyFollowed) {
      await strapi.db.query('api::interaction.interaction').create({
        data: {
          actionType: 'follow',
          targetType: 'user',
          targetDocumentId: post.author.documentId,
          user: actor.id,
        },
      });
      log(
        `Followed user "${post.author.username}" as "${actor.username}"`
      );
    }
  }
}

async function generateComment(
  anthropic: Anthropic,
  post: {
    title: string;
    content: TiptapNode;
    images: Array<{ url: string }>;
  },
  parentComment: { authorName: string; content: string } | null
): Promise<string | null> {
  // Build content blocks from richtext
  const imageCount = { value: 0 };
  const richTextBlocks = buildContentBlocks(post.content ?? {}, imageCount);
  const hasVideoInContent = richTextBlocks.some(
    (b) => b.type === 'text' && (b as Anthropic.TextBlockParam).text === '[video]'
  );

  // Append post.images media field (if slots remain)
  for (const img of post.images ?? []) {
    if (imageCount.value >= MAX_IMAGES) break;
    if (img.url?.startsWith('https://')) {
      richTextBlocks.push({
        type: 'image',
        source: { type: 'url', url: img.url },
      });
      imageCount.value++;
    }
  }

  const hasImages = imageCount.value > 0;
  const hasVideo = hasVideoInContent;
  // Constraint injected into prompts when there is no visual media
  const noMediaConstraint =
    !hasImages && !hasVideo
      ? `Bài viết này CHỈ có nội dung text, KHÔNG có ảnh hay video. Tuyệt đối không được nhắc đến ảnh hay video trong bình luận. `
      : '';

  let userContent: AnthropicContentBlock[];

  if (parentComment) {
    // Reply prompt — no need to include full post content
    userContent = [
      {
        type: 'text',
        text:
          `Bạn là một người dùng mạng xã hội Việt Nam bình thường, đang đọc bình luận này trong bài "${post.title}":\n\n` +
          `"${parentComment.content}" — ${parentComment.authorName}\n\n` +
          `Viết 1 phản hồi bằng tiếng Việt thông thường, kiểu người thật nhắn tin trên mạng. ` +
          `Ngắn gọn, tự nhiên, đôi khi có thể dùng từ lóng hoặc cách nói tắt. ` +
          `Không dùng emoji, không dùng ngôn ngữ formal, không sáo rỗng. ` +
          `Độ dài ngẫu nhiên 1-2 câu. Chỉ trả về nội dung phản hồi, không thêm gì khác.`,
      },
    ];
  } else {
    // Top-level comment prompt with full multimodal content
    const intro: AnthropicContentBlock = {
      type: 'text',
      text: `Bạn là một người đọc (KHÔNG phải tác giả) vừa đọc xong bài viết của người khác: "${post.title}"\n\nNội dung bài viết:`,
    };

    const outro: AnthropicContentBlock = {
      type: 'text',
      text:
        `\n\n${noMediaConstraint}` +
        `Viết 1 bình luận với tư cách người đọc, bày tỏ cảm nhận/ý kiến về bài viết của người khác. ` +
        `KHÔNG được viết như thể bạn là tác giả (không dùng "mình sẽ cố gắng", "cảm ơn các bạn đã xem"...). ` +
        `Dùng tiếng Việt thông thường, kiểu người thật nhắn tin trên mạng. Tự nhiên, không sáo rỗng, không formal. ` +
        `Đôi khi có thể dùng từ lóng hoặc cách nói tắt. Độ dài ngẫu nhiên 1-4 câu. Không dùng emoji. Chỉ trả về nội dung bình luận.`,
    };

    userContent =
      richTextBlocks.length > 0
        ? [intro, ...richTextBlocks, outro]
        : [
            {
              type: 'text',
              text:
                `Bạn là một người đọc (KHÔNG phải tác giả), vừa đọc bài của người khác: "${post.title}". ` +
                `${noMediaConstraint}` +
                `Viết 1 bình luận bày tỏ cảm nhận của người đọc. ` +
                `KHÔNG viết như thể bạn là tác giả (không dùng "mình sẽ cố gắng", "cảm ơn các bạn đã xem"...). ` +
                `Dùng tiếng Việt thông thường, tự nhiên, không sáo rỗng. Đôi khi có thể dùng từ lóng hoặc cách nói tắt. ` +
                `Độ dài ngẫu nhiên 1-4 câu. Không dùng emoji. Chỉ trả về nội dung bình luận.`,
            },
          ];
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = response.content[0];
  if (block?.type === 'text') {
    return block.text.trim() || null;
  }
  return null;
}
