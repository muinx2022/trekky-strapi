import { buildSeedUserDraft } from '../../../utils/seed-user-generator';

const USER_MODEL = 'plugin::users-permissions.user';
const ROLE_MODEL = 'plugin::users-permissions.role';
const DEFAULT_SEED_PASSWORD = 'Password@123';
declare const strapi: any;

type AnyObject = Record<string, any>;

function sanitizeUser(user: AnyObject) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    blocked: Boolean(user.blocked),
    confirmed: Boolean(user.confirmed),
    isSeeded: Boolean(user.isSeeded),
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          type: user.role.type,
        }
      : null,
  };
}

function parseSeedSuffix(username: string) {
  const match = username.match(/(\d+)$/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export default {
  async list(page: number, pageSize: number, keyword?: string, isSeeded = false) {
    const q = String(keyword ?? '').trim();
    const seededFilter = isSeeded
      ? { isSeeded: true }
      : {
          $or: [{ isSeeded: false }, { isSeeded: { $null: true } }],
        };

    const filters = q
      ? {
          $and: [
            seededFilter,
            {
              $or: [
                { username: { $containsi: q } },
                { email: { $containsi: q } },
              ],
            },
          ],
        }
      : seededFilter;

    const users = await strapi.entityService.findMany(USER_MODEL, {
      fields: ['id', 'username', 'email', 'blocked', 'confirmed', 'isSeeded'],
      populate: { role: { fields: ['id', 'name', 'type'] } },
      sort: { id: 'asc' },
      start: (page - 1) * pageSize,
      limit: pageSize,
      filters,
    });

    const total = await strapi.entityService.count(USER_MODEL, { filters });

    return {
      data: users.map((user: AnyObject) => sanitizeUser(user)),
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          total,
        },
      },
    };
  },

  async findOne(id: number) {
    const user = await strapi.entityService.findOne(USER_MODEL, id, {
      fields: ['id', 'username', 'email', 'blocked', 'confirmed', 'isSeeded'],
      populate: { role: { fields: ['id', 'name', 'type'] } },
    });

    if (!user) {
      return null;
    }

    return sanitizeUser(user as AnyObject);
  },

  async listRoles() {
    return strapi.entityService.findMany(ROLE_MODEL, {
      fields: ['id', 'name', 'type', 'description'],
      sort: { id: 'asc' },
      limit: 100,
    });
  },

  async create(payload: AnyObject) {
    const username = String(payload.username ?? '').trim();
    const email = String(payload.email ?? '').trim();
    const password = String(payload.password ?? '').trim();

    if (!username || !email || !password) {
      throw new Error('username, email and password are required');
    }

    const created = await strapi.entityService.create(USER_MODEL, {
      data: {
        username,
        email,
        password,
        blocked: Boolean(payload.blocked),
        confirmed: payload.confirmed !== false,
        isSeeded: Boolean(payload.isSeeded),
        role: payload.roleId ? Number(payload.roleId) : undefined,
      },
      populate: { role: { fields: ['id', 'name', 'type'] } },
    });

    return sanitizeUser(created as AnyObject);
  },

  async update(id: number, payload: AnyObject) {
    const data: AnyObject = {
      blocked: Boolean(payload.blocked),
      confirmed: payload.confirmed !== false,
    };

    if (typeof payload.username === 'string' && payload.username.trim()) {
      data.username = payload.username.trim();
    }

    if (typeof payload.email === 'string' && payload.email.trim()) {
      data.email = payload.email.trim();
    }

    if (typeof payload.password === 'string' && payload.password.trim()) {
      data.password = payload.password.trim();
    }

    if (payload.roleId !== undefined && payload.roleId !== null && payload.roleId !== '') {
      data.role = Number(payload.roleId);
    }

    const updated = await strapi.entityService.update(USER_MODEL, id, {
      data,
      populate: { role: { fields: ['id', 'name', 'type'] } },
    });

    return sanitizeUser(updated as AnyObject);
  },

  async remove(id: number) {
    await strapi.entityService.delete(USER_MODEL, id);
    return { id };
  },

  async seedAuthenticatedUsers(count: number) {
    const roleQuery = strapi.query(ROLE_MODEL);
    const authenticatedRole = await roleQuery.findOne({
      where: { $or: [{ type: 'authenticated' }, { name: 'Authenticated' }] },
    });

    if (!authenticatedRole?.id) {
      throw new Error('Authenticated role not found');
    }

    const seededUsers = (await strapi.entityService.findMany(USER_MODEL, {
      fields: ['username'],
      filters: { isSeeded: true },
      sort: { id: 'asc' },
      limit: 100000,
    })) as Array<{ username: string }>;

    const usedSuffixes = new Set<number>();
    for (const user of seededUsers) {
      const suffix = parseSeedSuffix(user.username);
      if (suffix) {
        usedSuffixes.add(suffix);
      }
    }

    let nextIndex = usedSuffixes.size > 0 ? Math.max(...Array.from(usedSuffixes)) + 1 : 1;

    let createdCount = 0;
    let startUsername: string | null = null;
    let endUsername: string | null = null;

    while (createdCount < count) {
      const draft = buildSeedUserDraft(nextIndex);
      nextIndex += 1;

      const existed = await strapi.entityService.findMany(USER_MODEL, {
        fields: ['id'],
        filters: {
          $or: [{ username: draft.username }, { email: draft.email }],
        },
        limit: 1,
      });

      if ((existed as AnyObject[]).length > 0) {
        continue;
      }

      await strapi.entityService.create(USER_MODEL, {
        data: {
          username: draft.username,
          email: draft.email,
          password: DEFAULT_SEED_PASSWORD,
          provider: 'local',
          confirmed: true,
          blocked: false,
          isSeeded: true,
          role: authenticatedRole.id,
          bio: `Seed user: ${draft.displayName}`,
        },
      });

      createdCount += 1;
      if (!startUsername) {
        startUsername = draft.username;
      }
      endUsername = draft.username;
    }

    return {
      createdCount,
      startUsername,
      endUsername,
      defaultPasswordHint: DEFAULT_SEED_PASSWORD,
    };
  },

  async batchDeleteSeedUsers(ids: number[]) {
    const normalizedIds = Array.from(new Set(ids.filter((value) => Number.isFinite(value) && value > 0)));

    if (normalizedIds.length === 0) {
      return {
        requestedCount: 0,
        deletedCount: 0,
        skippedCount: 0,
      };
    }

    const rows = (await strapi.entityService.findMany(USER_MODEL, {
      fields: ['id', 'isSeeded'],
      filters: {
        id: { $in: normalizedIds },
      },
      limit: normalizedIds.length,
    })) as Array<{ id: number; isSeeded?: boolean }>;

    const seededIds = rows.filter((row) => Boolean(row.isSeeded)).map((row) => row.id);

    for (const id of seededIds) {
      await strapi.entityService.delete(USER_MODEL, id);
    }

    return {
      requestedCount: normalizedIds.length,
      deletedCount: seededIds.length,
      skippedCount: normalizedIds.length - seededIds.length,
    };
  },
};
