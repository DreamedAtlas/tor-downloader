import { Branch } from "./dictionary";
import { PlatformArch } from "./PlatformArch";
import { Repository } from "./Repository";

class Release {
    private _version: string;
    private _platformArch: PlatformArch;

    private constructor(version: string, platformArch: PlatformArch) {
        this._version = version;
        this._platformArch = platformArch;
    }

    static fromValues(
        version: string,
        platform: NodeJS.Platform = process.platform,
        arch: string = process.arch,
    ) {
        return new Release(version, PlatformArch.fromNodeValues(platform, arch));
    }

    static async fromBranch(
        branch: Branch,
        platform: NodeJS.Platform = process.platform,
        arch: string = process.arch,
        repository: Repository = new Repository(),
    ) {
        const version = await repository.getLatestVersion(branch);
        return new Release(version, PlatformArch.fromNodeValues(platform, arch));
    }

    get version() {
        return this._version;
    }

    get platformArch() {
        return this._platformArch;
    }

    get platform() {
        return this.platformArch.platform;
    }

    getFilename() {
        return `tor-browser-${this.platformArch}-${this.version}_en-US.mar`;
    }

    getMarToolsFilename() {
        return `mar-tools-${this.platformArch.getMarToolsPlatformArch()}.zip`;
    }

    getMarToolsRelease() {
        return Release.fromValues(this.version);
    }
}

export { Release };
