import { Label } from "./primitives";

const REPOSITORY_PERMISSIONS = [
    "Metadata: Read-only",
    "Contents: Read-only",
    "Pull requests: Read and write",
];

const ACCOUNT_PERMISSIONS = ["Email addresses: Read-only"];

export function Trust() {
    return (
        <section
            id="access"
            className="field scroll-mt-20 border-b border-border py-24 lg:py-36"
        >
            <div className="shell">
                <div className="grid gap-10 lg:grid-cols-2 lg:gap-24">
                    <div data-reveal style={{ "--i": 0 } as React.CSSProperties}>
                        <Label>Access</Label>
                        <h2 className="section-head mt-6">
                            A GitHub App with scoped permissions.
                        </h2>
                    </div>

                    <div
                        className="grid gap-10 sm:grid-cols-2"
                        data-reveal
                        style={{ "--i": 1 } as React.CSSProperties}
                    >
                        <div>
                            <Label>Repository permissions</Label>
                            <ul className="mt-5 flex flex-col">
                                {REPOSITORY_PERMISSIONS.map((permission) => (
                                    <li
                                        key={permission}
                                        className="border-t border-border py-3.5 font-mono text-[15px] last:border-b"
                                    >
                                        {permission}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <Label>Account permissions</Label>
                            <ul className="mt-5 flex flex-col">
                                {ACCOUNT_PERMISSIONS.map((permission) => (
                                    <li
                                        key={permission}
                                        className="border-t border-border py-3.5 font-mono text-[15px] last:border-b"
                                    >
                                        {permission}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div
                    className="mt-14 flex flex-col"
                    data-reveal
                    style={{ "--i": 2 } as React.CSSProperties}
                >
                    <p className="body border-t border-border py-4">
                        Only the repositories you select.
                    </p>
                    <p className="body border-t border-border py-4">
                        Disconnect anytime. It uninstalls the app from GitHub.
                    </p>
                </div>
            </div>
        </section>
    );
}