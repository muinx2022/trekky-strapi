const USER_MODEL = 'plugin::users-permissions.user';
const ROLE_MODEL = 'plugin::users-permissions.role';
declare const strapi: any;

type AnyObject = Record<string, any>;

function sanitizeUser(user: AnyObject) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    blocked: Boolean(user.blocked),
    confirmed: Boolean(user.confirmed),
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          type: user.role.type,
        }
      : null,
  };
}

export default {
  async list(page: number, pageSize: number, keyword?: string) {
    const q = String(keyword ?? '').trim();
    const filters = q
      ? {
          $or: [
            { username: { $containsi: q } },
            { email: { $containsi: q } },
          ],
        }
      : undefined;

    const users = await strapi.entityService.findMany(USER_MODEL, {
      fields: ['id', 'username', 'email', 'blocked', 'confirmed'],
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
      fields: ['id', 'username', 'email', 'blocked', 'confirmed'],
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
};
