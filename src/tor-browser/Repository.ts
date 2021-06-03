import { Branch, Version } from "./dictionary";
import { RuntimeError } from "../errors";
import { request } from "../utils/http";
import { Release } from "./Release";

class Repository {
    private static MAIN_REPOSITORY_URL = "https://dist.torproject.org/torbrowser/";
    private static VERSION_REGEXP =
        /<a[^>]+href="\/?(?<version>\d{1,3}\.\d{1,3}[a\.]?\d{0,3})\/?"[^>]*>/g;

    private _repositoryUrl: string;

    constructor(repositoryUrl: string = Repository.MAIN_REPOSITORY_URL) {
        if (!/^https?:\/\//i.test(repositoryUrl)) {
            throw new TypeError("repositoryUrl must be a valid url");
        }

        this._repositoryUrl = repositoryUrl;

        if (!this._repositoryUrl.endsWith("/")) {
            this._repositoryUrl += "/";
        }
    }

    private static sortVersions(a: Version, b: Version): number {
        const numberize = (version: Version) => {
            const {
                groups: { major, minor, fix },
            } = version.match(/^(?<major>\d{1,3})\.(?<minor>\d{1,3})[a\.]?(?<fix>\d{0,3})$/);
            return (
                Number.parseInt(major) * 1000000 +
                Number.parseInt(minor) * 1000 +
                Number.parseInt(fix)
            );
        };

        return numberize(a) - numberize(b);
    }

    get repositoryUrl() {
        return this._repositoryUrl;
    }

    async getLatestVersion(branch: Branch = Branch.STABLE) {
        const repoPageContent = await request(this.repositoryUrl);

        const availableVersions: Version[] = [];
        let match;
        while ((match = Repository.VERSION_REGEXP.exec(repoPageContent)) !== null) {
            const { version } = match.groups;
            if (
                (Branch.STABLE === branch && !version.includes("a")) ||
                (Branch.ALPHA === branch && version.includes("a"))
            ) {
                availableVersions.push(version);
            }
        }

        const latestVersion: Version = availableVersions.sort(Repository.sortVersions).pop();

        if (!latestVersion) {
            throw new RuntimeError(`No latest "${branch}" version found on the repository`);
        }

        return latestVersion;
    }

    getReleaseDirectoryUrl(version: Version): string {
        return `${this.repositoryUrl}${version}/`;
    }

    getReleaseUrl(release: Release): string {
        return `${this.getReleaseDirectoryUrl(release.version)}${release.getFilename()}`;
    }

    getMarToolsUrl(release: Release): string {
        return `${this.getReleaseDirectoryUrl(release.version)}${release.getMarToolsFilename()}`;
    }
}

export { Repository };
