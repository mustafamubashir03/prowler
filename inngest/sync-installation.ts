import { syncInstallation } from "@/features/auth/github/lib/sync-installation";
import { inngest } from "./client";

/**
 * The installation sync runs here rather than inside the webhook request.
 *
 * syncInstallation pages every repository the installation can reach and writes
 * them in one transaction, which took 36 seconds on a ~90-repository account.
 * GitHub waits 10 seconds for a webhook response and records anything later as a
 * failed delivery, so every installation_repositories event was logged as a 500
 * even though the sync itself succeeded. Acknowledging the delivery immediately
 * and doing the work in the background keeps the delivery green.
 */
export const syncGitHubInstallation = inngest.createFunction(
    {
        id: "sync-github-installation",
        name: "Sync GitHub Installation",
        triggers: [
            {
                event: "installation/sync.requested",
            },
        ],
        retries: 3,
    },
    async ({ event }) => {
        const { githubInstallationId, userId } = event.data as {
            githubInstallationId: number;
            userId?: string;
        };

        if (!githubInstallationId) {
            throw new Error("installation/sync.requested is missing githubInstallationId");
        }

        await syncInstallation(githubInstallationId, userId);

        return { githubInstallationId };
    },
);