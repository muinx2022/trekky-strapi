import { fakerVI as faker } from '@faker-js/faker';

const EMAIL_PROVIDERS = ['gmail.com', 'hotmail.com', 'live.com', 'outlook.com', 'yahoo.com'] as const;

function normalizeAscii(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizeWords(input: string) {
  return normalizeAscii(input)
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
}

function buildUsername(words: string[], suffix: number) {
  const first = words[0] ?? 'user';
  const middle = words[1] ?? '';
  const last = words[words.length - 1] ?? 'vietnam';
  const middleInitial = middle ? middle[0] : '';

  const candidates = [
    `${first}${last}`,
    `${last}${first}`,
    `${first}${middle}${last}`,
    `${first}${middle}`,
    `${middle}${last}`,
    `${first}.${last}`,
    `${first}_${last}`,
    `${first}${middleInitial}${last}`,
    `${first}-${last}`,
  ]
    .map((value) => value.replace(/[._-]{2,}/g, '.').replace(/^[._-]+|[._-]+$/g, ''))
    .filter((value) => value.length >= 4);

  const base = faker.helpers.arrayElement(candidates.length > 0 ? candidates : ['uservietnam']);
  const numericMode = faker.helpers.weightedArrayElement([
    { weight: 4, value: 'none' as const },
    { weight: 4, value: 'two' as const },
    { weight: 2, value: 'four' as const },
  ]);

  if (numericMode === 'none') {
    return base;
  }
  if (numericMode === 'two') {
    return `${base}${String(suffix % 100).padStart(2, '0')}`;
  }
  return `${base}${String(suffix % 10000).padStart(4, '0')}`;
}

export type SeedUserDraft = {
  displayName: string;
  username: string;
  email: string;
};

export function buildSeedUserDraft(index: number): SeedUserDraft {
  const displayName = faker.person.fullName();
  const words = tokenizeWords(displayName);
  const username = buildUsername(words, index);
  const provider = faker.helpers.arrayElement(EMAIL_PROVIDERS);
  const email = `${username}@${provider}`;

  return {
    displayName,
    username,
    email,
  };
}
