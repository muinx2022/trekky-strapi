import OpenAI from 'openai';
import type { Core } from '@strapi/strapi';

const BATCH_SIZE = parseInt(process.env.CRON_POSTS_PER_RUN ?? '5', 10);
const MAX_IMAGES = 5;
const MODEL = process.env.OPENAI_AUTO_ENGAGE_MODEL ?? 'gpt-4.1-mini';

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

type OpenAIInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' };

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return collapseWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function buildContentBlocks(
  node: TiptapNode,
  imageCount: { value: number }
): OpenAIInputContent[] {
  const blocks: OpenAIInputContent[] = [];

  if (!node) return blocks;

  if (node.type === 'text' && node.text) {
    blocks.push({ type: 'input_text', text: node.text });
    return blocks;
  }

  if (node.type === 'image' && imageCount.value < MAX_IMAGES) {
    const src = node.attrs?.src as string | undefined;
    if (src?.startsWith('https://')) {
      blocks.push({ type: 'input_image', image_url: src, detail: 'auto' });
      imageCount.value++;
    }
    return blocks;
  }

  if (node.type === 'video') {
    blocks.push({ type: 'input_text', text: '[video]' });
    return blocks;
  }

  if (node.content) {
    for (const child of node.content) {
      blocks.push(...buildContentBlocks(child, imageCount));
    }
  }

  return blocks;
}

function extractPlainText(node: TiptapNode | null | undefined): string {
  if (!node) return '';

  if (node.type === 'text' && node.text) {
    return node.text;
  }

  if (node.type === 'video') {
    return ' [video] ';
  }

  const parts = (node.content ?? [])
    .map((child) => extractPlainText(child))
    .filter(Boolean);

  if (!parts.length) return '';

  const joined = parts.join(node.type === 'paragraph' || node.type === 'heading' ? '\n' : ' ');
  return collapseWhitespace(joined);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function autoEngage(strapi: Core.Strapi) {
  const log = (msg: string) => console.log(`[cron:autoEngage] ${msg}`);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    log('OPENAI_API_KEY not set - skipping.');
    return;
  }

  const seededUsers = (await strapi.db
    .query('plugin::users-permissions.user')
    .findMany({
      where: { isSeeded: true, blocked: false, confirmed: true },
      limit: 200,
    })) as Array<{ id: number; documentId: string; username: string; email: string }>;

  if (!seededUsers.length) {
    log('No seeded users (isSeeded=true) found - skipping.');
    return;
  }

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
  log(`Processing ${posts.length} posts (offset ${currentOffset} -> ${nextOffset})`);

  if (!posts.length) {
    log('No published posts found.');
    return;
  }

  const openai = new OpenAI({ apiKey });

  for (const post of posts) {
    try {
      await engagePost(strapi, openai, post, seededUsers, log);
    } catch (err) {
      log(`Error on post ${post.documentId}: ${err}`);
    }
  }
}

async function engagePost(
  strapi: Core.Strapi,
  openai: OpenAI,
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
  const candidates = seededUsers.filter((u) => u.id !== post.author?.id);
  if (!candidates.length) return;
  const actor = pickRandom(candidates);

  const existingComments = (await strapi.db.query('api::comment.comment').findMany({
    where: { targetType: 'post', targetDocumentId: post.documentId },
    limit: 50,
  })) as Array<{ id: number; documentId: string; authorName: string; content: string }>;

  const shouldReply = existingComments.length > 0 && Math.random() < 0.5;
  const parentComment = shouldReply ? pickRandom(existingComments) : null;

  const generatedComment = await generateComment(openai, post, parentComment);

  if (!generatedComment) {
    log(`Skipped comment for post ${post.documentId} - empty AI response`);
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
    log(`Commented on post ${post.documentId} as "${actor.username}"${parentComment ? ' (reply)' : ''}`);
  }

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

  if (post.author && post.author.id !== actor.id) {
    const alreadyFollowed = await strapi.db.query('api::interaction.interaction').findOne({
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
      log(`Followed user "${post.author.username}" as "${actor.username}"`);
    }
  }
}

async function generateComment(
  openai: OpenAI,
  post: {
    title: string;
    content: TiptapNode;
    images: Array<{ url: string }>;
  },
  parentComment: { authorName: string; content: string } | null
): Promise<string | null> {
  const imageCount = { value: 0 };
  const richTextBlocks = buildContentBlocks(post.content ?? {}, imageCount);
  const plainPostText = extractPlainText(post.content);
  const hasVideoInContent = richTextBlocks.some(
    (b) => b.type === 'input_text' && b.text === '[video]'
  );

  for (const img of post.images ?? []) {
    if (imageCount.value >= MAX_IMAGES) break;
    if (img.url?.startsWith('https://')) {
      richTextBlocks.push({ type: 'input_image', image_url: img.url, detail: 'auto' });
      imageCount.value++;
    }
  }

  const hasImages = imageCount.value > 0;
  const hasVideo = hasVideoInContent;
  const hasBodyText = plainPostText.length > 0;
  const titleOnly = !hasBodyText && !hasImages && !hasVideo;
  const sparseInput = !hasBodyText && (hasImages || hasVideo);
  const sanitizedParentComment = parentComment
    ? {
        authorName: collapseWhitespace(parentComment.authorName),
        content: stripHtml(parentComment.content),
      }
    : null;

  const systemPrompt =
    'Bạn là người dùng mạng xã hội Việt Nam đang comment vào bài của người khác. ' +
    'Viết tự nhiên như người thật: ngắn, đời thường, không formal, không emoji. ' +
    'Đọc kỹ tiêu đề và nội dung bài để hiểu tâm trạng, chủ đề rồi mới phản ứng. ' +
    'Với bài cảm xúc (buồn, vui, nhớ, mệt...): hỏi thăm hoặc đồng cảm tự nhiên. ' +
    'Với bài ảnh đẹp/địa điểm: khen trực quan hoặc hỏi chỗ đó ở đâu. ' +
    'Với bài chia sẻ thông thường: phản ứng đúng với nội dung. ' +
    'Chỉ trả về nội dung comment, không thêm gì khác.';

  const inputConstraint = !hasImages && !hasVideo
    ? 'Bài không có ảnh/video, chỉ dựa vào text.'
    : titleOnly || sparseInput
      ? 'Bài ít nội dung, hãy phản ứng ngắn và tự nhiên với những gì có.'
      : '';

  let userContent: OpenAIInputContent[];

  if (sanitizedParentComment) {
    userContent = [
      {
        type: 'input_text',
        text:
          `Bài viết: "${post.title}"\n` +
          `Comment cần reply: "${sanitizedParentComment.content}" - ${sanitizedParentComment.authorName}\n` +
          (inputConstraint ? `Lưu ý: ${inputConstraint}\n` : '') +
          'Viết 1 reply ngắn tự nhiên, như đang tám trên mạng. Không lặp lại nguyên xi ý người trước.',
      },
    ];
  } else {
    const intro: OpenAIInputContent = {
      type: 'input_text',
      text:
        `Bài viết: "${post.title}"\n` +
        (hasBodyText ? `Nội dung: "${plainPostText.slice(0, 1200)}"\n` : '') +
        (richTextBlocks.length > 0 ? 'Ảnh/nội dung đính kèm:' : ''),
    };

    const outro: OpenAIInputContent = {
      type: 'input_text',
      text:
        (inputConstraint ? `\nLưu ý: ${inputConstraint}\n` : '\n') +
        'Viết 1 comment 1-2 câu với tư cách người đọc. Phản ứng đúng tâm trạng/chủ đề bài.',
    };

    userContent =
      richTextBlocks.length > 0
        ? [intro, ...richTextBlocks, outro]
        : [
            {
              type: 'input_text',
              text:
                `Bài viết: "${post.title}". ` +
                (hasBodyText ? `Nội dung: "${plainPostText.slice(0, 1200)}". ` : '') +
                (inputConstraint ? `Lưu ý: ${inputConstraint} ` : '') +
                'Viết 1 comment 1-2 câu, tự nhiên, đúng với tâm trạng/chủ đề bài.',
            },
          ];
  }

  const response = await openai.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: [
      {
        role: 'user',
        content: userContent,
      },
    ],
    max_output_tokens: 150,
  });

  return response.output_text.trim() || null;
}
