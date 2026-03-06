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

async function ensureExtendedUsersPermissionsColumns(strapi: Core.Strapi) {
  const connection = strapi.db?.connection;
  if (!connection?.schema) {
    return;
  }

  try {
    const hasIsSeeded = await connection.schema.hasColumn('up_users', 'is_seeded');
    const hasBio = await connection.schema.hasColumn('up_users', 'bio');

    if (!hasIsSeeded || !hasBio) {
      await connection.schema.alterTable('up_users', (table: any) => {
        if (!hasIsSeeded) {
          table.boolean('is_seeded').defaultTo(false);
        }
        if (!hasBio) {
          table.text('bio');
        }
      });
      console.log(
        `[bootstrap] Added missing up_users columns: ${[
          !hasIsSeeded ? 'is_seeded' : null,
          !hasBio ? 'bio' : null,
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }
  } catch (error) {
    console.error('[bootstrap] Failed to ensure up_users extended columns:', error);
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register() {
    // On Windows, formidable temp-file cleanup can throw EBUSY when Node still
    // holds a file handle after upload. Swallow only those errors so the server
    // doesn't crash — the upload itself has already succeeded at that point.
    if (process.platform === 'win32') {
      process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
        if ((err.code === 'EBUSY' || err.code === 'EPERM') && err.syscall === 'unlink') {
          console.warn(`[upload] Ignored ${err.code} on temp-file cleanup:`, err.path);
          return;
        }
        // Re-throw anything else so real crashes still surface.
        throw err;
      });
    }
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await hardenUploadSettingsForWindows(strapi);
    await ensureExtendedUsersPermissionsColumns(strapi);

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
          'api::tag.tag.find',
          'api::tag.tag.findOne',
          'api::page.page.find',
          'api::page.page.findOne',
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
      // Grant authenticated users permission to create tags via the web.
      const roleQuery = strapi.query('plugin::users-permissions.role');
      const authenticatedRole = await roleQuery.findOne({
        where: { $or: [{ type: 'authenticated' }, { name: 'Authenticated' }] },
      });

      if (authenticatedRole?.id) {
        const permissionsToGrant = [
          'api::tag.tag.userCreate',
          'api::tag.tag.find',
          'api::tag.tag.findOne',
          'plugin::users-permissions.user.update',
        ];

        const existingPermissions = await strapi
          .query('plugin::users-permissions.permission')
          .findMany({ where: { role: { id: authenticatedRole.id } } });

        const existingActionNames = existingPermissions.map((p) => p.action);
        const permissionsToAdd = permissionsToGrant.filter(
          (action) => !existingActionNames.includes(action)
        );

        for (const action of permissionsToAdd) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: authenticatedRole.id },
          });
        }

        if (permissionsToAdd.length > 0) {
          console.log('[bootstrap] Granted authenticated role permissions:', permissionsToAdd.join(', '));
        }
      }
    } catch (error) {
      console.error('Error bootstrapping authenticated role permissions:', error);
    }
  },
};
