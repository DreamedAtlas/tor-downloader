import { RuntimeError } from "../errors";
import { ReleasePlatform } from "./dictionary";

class PlatformArch {
    private static SEPARATOR = "|";
    private static NODE_SUPPORTED = [
        "darwin|x64",
        "linux|ia32",
        "linux|x64",
        "win32|ia32",
        "win32|x64",
    ];

    private _platform: ReleasePlatform;
    private _arch: string;

    private constructor(nodePlatform: NodeJS.Platform, nodeArch: string) {
        switch (nodePlatform) {
            case "darwin":
                this._platform = "osx";
                break;
            case "win32":
                this._platform = "win";
                break;
            case "linux":
                this._platform = "linux";
                break;
            default:
                this._platform = "__unsupported";
        }

        switch (nodeArch) {
            case "x64":
                this._arch = "64";
                break;
            case "ia32":
                this._arch = "32";
                break;
            default:
                this._arch = "__unsupported";
        }
    }

    private static fromNodePlatformArch(nodePlatformArch: string) {
        const [nodePlatform, nodeArch] = nodePlatformArch.split(this.SEPARATOR);
        return new PlatformArch(nodePlatform as NodeJS.Platform, nodeArch);
    }

    private static getArrayFromArrayOfNodePlatformArch(nodePlatformArchs: string[]) {
        return nodePlatformArchs.map((nodePlatformArch) =>
            PlatformArch.fromNodePlatformArch(nodePlatformArch),
        );
    }

    static fromNodeValues(
        nodePlatform: NodeJS.Platform = process.platform,
        nodeArch: string = process.arch,
    ) {
        const platformArch = new PlatformArch(nodePlatform, nodeArch);
        const supportedPlatformArchs = PlatformArch.getArrayFromArrayOfNodePlatformArch(
            this.NODE_SUPPORTED,
        );

        if (
            !supportedPlatformArchs.some((supportedPlatformArch) =>
                platformArch.equals(supportedPlatformArch),
            )
        ) {
            throw new RuntimeError(
                `Unsupported platform architecture: ${nodePlatform} ${nodeArch}`,
            );
        }

        return platformArch;
    }

    get platform(): ReleasePlatform {
        return this._platform;
    }

    get arch() {
        return this._arch;
    }

    equals(platformArch: PlatformArch) {
        return this.platform === platformArch.platform && this.arch === platformArch.arch;
    }

    getMarToolsPlatformArch() {
        let platform = this.platform;
        if (this.platform === "osx") {
            platform = "mac";
        }
        return `${platform}${this.arch}`;
    }

    toString() {
        return `${this.platform}${this.arch}`;
    }
}

export { PlatformArch };
