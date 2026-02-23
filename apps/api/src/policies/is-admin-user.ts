type JwtPayload = {
  id?: number;
};

export default async (policyContext: any, _config: unknown, { strapi }: any) => {
  const authHeader = policyContext.request.header?.authorization as string | undefined;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return false;
  }

  try {
    const jwtService = strapi.plugin("users-permissions").service("jwt");
    const payload = (await jwtService.verify(token)) as JwtPayload;

    if (!payload?.id) {
      return false;
    }

    const user = await strapi.entityService.findOne("plugin::users-permissions.user", payload.id, {
      populate: ["role"],
    });

    const roleName = String(user?.role?.name ?? "").toLowerCase();
    const roleType = String(user?.role?.type ?? "").toLowerCase();

    return roleName === "admin" || roleType === "admin";
  } catch {
    return false;
  }
};
