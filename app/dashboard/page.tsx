import { requireAuth } from "@/features/auth/session";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { db } from "@/src/prisma/db";

// The dashboard always reads the session cookie, which is a request read and
// cannot be prerendered into the static shell. Allow it to block on the server.
export const instant = false;

export default async function DashboardPage() {
  const session = await requireAuth();

  const installations = await db.orm.public.GitHubInstallation
    .where({ userId: session.user.id })
    .orderBy((fields) => fields.createdAt.desc())
    .include("repositories", (repositories) => repositories.count())
    .all();

  return (
    <Dashboard
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      installations={installations.map((installation) => ({
        id: installation.id,
        githubInstallationId: installation.githubInstallationId,
        targetLogin: installation.targetLogin,
        targetType: installation.targetType,
        status: installation.status,
        repositorySelection: installation.repositorySelection,
        repoCount: installation.repositories,
      }))}
    />
  );
}