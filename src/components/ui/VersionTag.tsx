import { appVersion, commitUrl, gitSha, shortSha } from "@/lib/build-info";

/** "v1.2.3 · abc1234", the hash linking to the commit on GitHub. */
export function VersionTag() {
  return (
    <>
      v{appVersion}
      {commitUrl && (
        <>
          {" "}&middot;{" "}
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Build ${gitSha}`}
            className="font-mono hover:underline"
          >
            {shortSha}
          </a>
        </>
      )}
    </>
  );
}
