import { assertUserCanAccessRepository } from "@/lib/github/tenancy";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type RepositoryRow = {
    id: string;
    githubRepositoryId: string;
    installationId: string;
    owner: string;
    name: string;
    defaultBranch: string;
    private: boolean;
    fullName: string;
};

/**
 * The single answer to "may this caller read this repository", as an HTTP
 * outcome.
 *
 * Two statuses, chosen deliberately:
 *
 *   401 when there is no session. The caller has not identified themselves, so
 *       there is nothing to hide the existence of anything behind.
 *   404 when there is a session but the repository is not theirs. Answering 403
 *       would confirm that the repository exists, which turns the endpoint into
 *       an oracle for enumerating repository ids across every account on the
 *       instance.
 *
 * Every repository route returns this shape, so the mapping cannot drift
 * between them.
 */
export type RepositoryAccess =
    | { response: Response }
    | { userId: string; repository: RepositoryRow };

export async function requireRepositoryAccess(
    id: string | null,
): Promise<RepositoryAccess> {
    if (!id) {
        return {
            response: Response.json(
                { error: "Not found" },
                { status: 404 },
            ),
        };
    }

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
        return {
            response: Response.json(
                { error: "Unauthorized" },
                { status: 401 },
            ),
        };
    }

    const repository = await assertUserCanAccessRepository(
        session.user.id,
        id,
    );

    if (!repository) {
        return {
            response: Response.json(
                { error: "Not found" },
                { status: 404 },
            ),
        };
    }

    return {
        userId: session.user.id,
        repository: repository as RepositoryRow,
    };
}