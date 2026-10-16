import { getSessionUser, ok, unauthorized, effectivePerms } from "@/lib/api";
import { withPublic } from "@/lib/api";

export const GET = withPublic(async () => {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branch: user.branch,
    memberProfile: user.memberProfile,
    trainerProfile: user.trainerProfile,
    permissions: [...effectivePerms(user)],
  });
}, { params: Promise.resolve({}) });
