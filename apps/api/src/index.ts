import type { Core } from '@strapi/strapi';

async function hardenUploadSettingsForWindows(strapi: Core.Strapi) {
  if (process.platform !== 'win32') {
    return;
  }

  try {
    const settingsStore = strapi.store({
      type: 'plugin',
      name: 'upload',
      key: 'settings',
    });

    const current = ((await settingsStore.get({})) ?? {}) as {
      sizeOptimization?: boolean;
      responsiveDimensions?: boolean;
      autoOrientation?: boolean;
      aiMetadata?: boolean;
    };

    const next = {
      ...current,
      // Avoid Windows temp-file lock issues during local image optimization.
      sizeOptimization: false,
      responsiveDimensions: false,
      autoOrientation: false,
    };

    const changed =
      current.sizeOptimization !== next.sizeOptimization ||
      current.responsiveDimensions !== next.responsiveDimensions ||
      current.autoOrientation !== next.autoOrientation;

    if (changed) {
      await settingsStore.set({ value: next });
      console.log('[bootstrap] Disabled upload optimization/responsive dimensions on Windows.');
    }
  } catch (error) {
    console.error('[bootstrap] Failed to harden upload settings for Windows:', error);
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await hardenUploadSettingsForWindows(strapi);

    try {
      // Find the public role
      const publicRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'public' } });

      if (publicRole) {
        // Define the permissions to grant
        const permissionsToGrant = [
          'api::post.post.find',
          'api::post.post.findOne',
          'api::category.category.find',
          'api::category.category.findOne',
          'api::comment.comment.find',
          'api::comment.comment.findOne',
        ];

        // Fetch existing permissions for the public role
        const existingPermissions = await strapi
          .query('plugin::users-permissions.permission')
          .findMany({ where: { role: { id: publicRole.id } } });

        const existingActionNames = existingPermissions.map((p) => p.action);

        // Find which permissions are missing
        const permissionsToAdd = permissionsToGrant.filter(
          (action) => !existingActionNames.includes(action)
        );

        if (permissionsToAdd.length > 0) {
          for (const action of permissionsToAdd) {
            await strapi.query('plugin::users-permissions.permission').create({
              data: {
                action,
                role: publicRole.id,
              },
            });
          }
          console.log('Successfully granted public API access to required endpoints.');
        }
      }
    } catch (error) {
      console.error('Error bootstrapping public permissions:', error);
    }

    try {
      // Recover a usable users-permissions admin account if data was corrupted.
      const roleQuery = strapi.query('plugin::users-permissions.role');
      const adminRole = await roleQuery.findOne({
        where: {
          $or: [{ type: 'admin' }, { name: 'Admin' }],
        },
      });

      if (!adminRole?.id) {
        console.warn('[bootstrap] Cannot find users-permissions Admin role.');
        return;
      }

      const identifier = String(process.env.UP_ADMIN_IDENTIFIER ?? 'admin').trim();
      const email = String(process.env.UP_ADMIN_EMAIL ?? 'admin@example.com').trim().toLowerCase();
      const password = String(process.env.UP_ADMIN_PASSWORD ?? 'admin123').trim();

      const users = (await strapi.query('plugin::users-permissions.user').findMany({
        where: {
          $or: [{ email }, { username: identifier }],
        },
        populate: ['role'],
      })) as Array<{ id: number; password?: string | null }>;

      const userService = strapi.plugin('users-permissions').service('user');
      const target = users[0];

      if (target?.id) {
        await userService.edit(target.id, {
          username: identifier,
          email,
          password,
          provider: 'local',
          confirmed: true,
          blocked: false,
          role: adminRole.id,
        });
        console.log('[bootstrap] Synced users-permissions admin user credentials.');
      } else {
        await userService.add({
          username: identifier,
          email,
          password,
          provider: 'local',
          confirmed: true,
          blocked: false,
          role: adminRole.id,
        });
        console.log('[bootstrap] Created users-permissions admin user.');
      }
    } catch (error) {
      console.error('Error bootstrapping users-permissions admin account:', error);
    }

    try {
      // Ensure at least one valid authenticated user for web login.
      const roleQuery = strapi.query('plugin::users-permissions.role');
      const authenticatedRole = await roleQuery.findOne({
        where: {
          $or: [{ type: 'authenticated' }, { name: 'Authenticated' }],
        },
      });

      if (!authenticatedRole?.id) {
        console.warn('[bootstrap] Cannot find users-permissions Authenticated role.');
        return;
      }

      const identifier = String(process.env.UP_WEB_IDENTIFIER ?? 'demo').trim();
      const email = String(process.env.UP_WEB_EMAIL ?? 'demo@example.com').trim().toLowerCase();
      const password = String(process.env.UP_WEB_PASSWORD ?? 'demo123').trim();

      const users = (await strapi.query('plugin::users-permissions.user').findMany({
        where: {
          $or: [{ email }, { username: identifier }],
        },
      })) as Array<{ id: number }>;

      const userService = strapi.plugin('users-permissions').service('user');
      const target = users[0];

      if (target?.id) {
        await userService.edit(target.id, {
          username: identifier,
          email,
          password,
          provider: 'local',
          confirmed: true,
          blocked: false,
          role: authenticatedRole.id,
        });
        console.log('[bootstrap] Synced users-permissions demo web user credentials.');
      } else {
        await userService.add({
          username: identifier,
          email,
          password,
          provider: 'local',
          confirmed: true,
          blocked: false,
          role: authenticatedRole.id,
        });
        console.log('[bootstrap] Created users-permissions demo web user.');
      }
    } catch (error) {
      console.error('Error bootstrapping users-permissions demo web user:', error);
    }
  },
};
