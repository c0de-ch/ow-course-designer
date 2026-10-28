const REPO_URL = "https://github.com/c0de-ch/ow-course-designer";

/** Release version baked in at build time (package.json or the release tag). */
export const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/** Full commit hash the build was made from, empty when unknown. */
export const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "";

/** Same 7-character hash as the image tag (sha-<hash>). */
export const shortSha = gitSha.slice(0, 7);

export const commitUrl = gitSha ? `${REPO_URL}/commit/${gitSha}` : null;
