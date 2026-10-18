import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const assertUserCanAccessRepository = vi.fn();

vi.mock("@/lib/auth", () => ({
    auth: { api: { getSession } },
}));

// Next's async storage throws outside a request scope, which is exactly the
// environment a unit test runs in.
vi.mock("next/headers", () => ({
    headers: async () => new Headers(),
}));

vi.mock("@/lib/github/tenancy", () => ({
    assertUserCanAccessRepository,
}));

const { requireRepositoryAccess } = await import("./guard");

const REPO = {
    id: "row-1",
    githubRepositoryId: "1419742043",
    installationId: "inst-1",
    owner: "mustafamubashir03",
    name: "prowler",
    defaultBranch: "main",
    private: false,
    fullName: "mustafamubashir03/prowler",
};

function statusOf(access: unknown) {
    return (access as { response?: Response }).response?.status;
}

describe("requireRepositoryAccess", () => {
    beforeEach(() => {
        getSession.mockReset();
        assertUserCanAccessRepository.mockReset();
    });

    it("returns 401 when there is no session", async () => {
        getSession.mockResolvedValue(null);

        const access = await requireRepositoryAccess("1419742043");

        expect(statusOf(access)).toBe(401);
        expect(
            assertUserCanAccessRepository,
            "must not reach the ownership check without a session",
        ).not.toHaveBeenCalled();
    });

    it("returns 404 when the caller does not own the repository", async () => {
        getSession.mockResolvedValue({ user: { id: "user-a" } });
        assertUserCanAccessRepository.mockResolvedValue(null);

        const access = await requireRepositoryAccess("999");

        expect(statusOf(access)).toBe(404);
        expect(assertUserCanAccessRepository).toHaveBeenCalledWith(
            "user-a",
            "999",
        );
    });

    it("returns 404 rather than 403 for a repository that exists elsewhere", async () => {
        // 403 would confirm the id is real, turning the endpoint into an oracle
        // for enumerating repositories across accounts.
        getSession.mockResolvedValue({ user: { id: "user-a" } });
        assertUserCanAccessRepository.mockResolvedValue(null);

        expect(statusOf(await requireRepositoryAccess("some-real-repo"))).toBe(
            404,
        );
    });

    it("returns 404 for a missing id without consulting the session", async () => {
        const access = await requireRepositoryAccess(null);

        expect(statusOf(access)).toBe(404);
        expect(getSession).not.toHaveBeenCalled();
    });

    it("returns the repository when the caller owns it", async () => {
        getSession.mockResolvedValue({ user: { id: "user-a" } });
        assertUserCanAccessRepository.mockResolvedValue(REPO);

        const access = await requireRepositoryAccess("1419742043");

        expect(statusOf(access)).toBeUndefined();
        expect(access).toMatchObject({ userId: "user-a", repository: REPO });
    });
});