import { spawn } from "child_process";
import { RuntimeError } from "./errors";
import { createWriteStream as createFSWriteStream } from "fs";
import { basename as basenamePath, join as joinPath } from "path";
import {
    Branch as TorBrowserBranch,
    ReleasePlatform as TorBrowserReleasePlatform,
} from "./tor-browser/dictionary";
import { Release as TorBrowserRelease } from "./tor-browser/Release";
import { Repository as TorBrowserRepository } from "./tor-browser/Repository";
import { decompressXz, unzip } from "./utils/archive";
import { chmodAddX, mkdir, mkdirTemp, readdir, rename, rm } from "./utils/fs";
import { requestStream } from "./utils/http";

class TorDownloader {
    private static TOR_BINARY_FILENAME = "tor";
    private static MAR_BINARY_FILE_PATH = "mar-tools/signmar";
    private static UNPACKED_TOR_BROWSER_PATH = "tor-browser";

    private repository: TorBrowserRepository;
    private operationDirectoryPath: string;
    private torBrowserFilePath: string;
    private marToolsFilePath: string;

    constructor(repository: TorBrowserRepository = new TorBrowserRepository()) {
        this.repository = repository;
    }

    private static async fetchFile(url: string, directoryPath: string) {
        const filename = basenamePath(url);
        const filePath = joinPath(directoryPath, filename);

        const fileWriteStream = createFSWriteStream(filePath);
        await requestStream(fileWriteStream, url);

        return filePath;
    }

    private async fetchTorBrowser(torBrowserRelease: TorBrowserRelease) {
        return await TorDownloader.fetchFile(
            this.repository.getReleaseUrl(torBrowserRelease),
            this.operationDirectoryPath,
        );
    }

    private async fetchMarTools(torBrowserRelease: TorBrowserRelease) {
        return await TorDownloader.fetchFile(
            this.repository.getMarToolsUrl(torBrowserRelease),
            this.operationDirectoryPath,
        );
    }

    private getMarBinaryPath() {
        if (process.platform === "win32") {
            return joinPath(
                this.operationDirectoryPath,
                `${TorDownloader.MAR_BINARY_FILE_PATH}.exe`,
            );
        }
        return joinPath(this.operationDirectoryPath, TorDownloader.MAR_BINARY_FILE_PATH);
    }

    private execMarUnpack(toPath: string) {
        return new Promise<number>((resolve, reject) => {
            const marProcess = spawn(
                this.getMarBinaryPath(),
                ["-C", toPath, "-x", this.torBrowserFilePath],
                {
                    cwd: this.operationDirectoryPath,
                },
            );

            marProcess.on("error", reject);

            marProcess.on("close", (code) => resolve(code));
        });
    }

    private async unpackTorBrowser() {
        await chmodAddX(this.getMarBinaryPath());

        const unpackedTorBrowserPath = joinPath(
            this.operationDirectoryPath,
            TorDownloader.UNPACKED_TOR_BROWSER_PATH,
        );

        try {
            await mkdir(unpackedTorBrowserPath);
        } catch (err) {
            if (!err.message.includes("EEXIST")) {
                throw err;
            }
        }

        await this.execMarUnpack(unpackedTorBrowserPath);

        return unpackedTorBrowserPath;
    }

    private async moveTorFilesToLocation(
        path: string,
        platform: NodeJS.Platform | TorBrowserReleasePlatform,
    ) {
        const unpackedTorBrowserPath = joinPath(
            this.operationDirectoryPath,
            TorDownloader.UNPACKED_TOR_BROWSER_PATH,
        );

        let torDataDirectoryPath: string;
        switch (platform) {
            case "darwin":
            case "osx":
                await rename(joinPath(unpackedTorBrowserPath, "Contents", "MacOS", "Tor"), path);
                await rename(
                    joinPath(path, "tor.real"),
                    joinPath(path, TorDownloader.TOR_BINARY_FILENAME),
                );
                torDataDirectoryPath = joinPath(
                    unpackedTorBrowserPath,
                    "Contents",
                    "Resources",
                    "TorBrowser",
                    "Tor",
                );
                break;
            case "linux":
            case "win32":
            case "win":
                await rename(joinPath(unpackedTorBrowserPath, "TorBrowser", "Tor"), path);
                torDataDirectoryPath = joinPath(
                    unpackedTorBrowserPath,
                    "TorBrowser",
                    "Data",
                    "Tor",
                );
                break;
            default:
                throw new RuntimeError(`Unsupported platform: ${platform}`);
        }

        await rename(
            joinPath(torDataDirectoryPath, "torrc-defaults"),
            joinPath(path, "torrc-defaults"),
        );
        await rename(joinPath(torDataDirectoryPath, "geoip"), joinPath(path, "geoip"));
        await rename(joinPath(torDataDirectoryPath, "geoip6"), joinPath(path, "geoip6"));
    }

    private async decompressTorFiles(torDirectoryPath: string) {
        const files = await readdir(torDirectoryPath, { withFileTypes: true });

        await Promise.all(
            files.map(async (file) => {
                const filePath = joinPath(torDirectoryPath, file.name);

                if (file.isDirectory()) {
                    return await this.decompressTorFiles(filePath);
                }

                if (file.isFile()) {
                    const decompressedFilePath = `${filePath}.decompressed`;

                    await decompressXz(filePath, decompressedFilePath);

                    await rm(filePath);
                    await rename(decompressedFilePath, filePath);

                    return;
                }

                return await Promise.resolve();
            }),
        );
    }

    getTorBinaryFilename(platform: NodeJS.Platform | TorBrowserReleasePlatform = process.platform) {
        switch (platform) {
            case "win32":
            case "win":
                return `${TorDownloader.TOR_BINARY_FILENAME}.exe`;
            default:
                return TorDownloader.TOR_BINARY_FILENAME;
        }
    }

    async retrieve(torDirectoryPath: string, torBrowserRelease?: TorBrowserRelease) {
        if (!torBrowserRelease) {
            torBrowserRelease = await TorBrowserRelease.fromBranch(
                TorBrowserBranch.STABLE,
                process.platform,
                process.arch,
            );
        }

        this.operationDirectoryPath = await mkdirTemp();

        try {
            try {
                await mkdir(torDirectoryPath, { recursive: true });
            } catch (err) {
                if (!err.message.includes("EEXIST")) {
                    throw err;
                }
            }

            await Promise.all([
                // Get Tor Browser
                (async () => {
                    this.torBrowserFilePath = await this.fetchTorBrowser(torBrowserRelease);
                })(),

                // Get Mar Tools, Extract signmar
                (async () => {
                    this.marToolsFilePath = await this.fetchMarTools(
                        torBrowserRelease.getMarToolsRelease(),
                    );
                    await unzip(this.marToolsFilePath, this.operationDirectoryPath);
                })(),
            ]);

            await this.unpackTorBrowser();

            await this.moveTorFilesToLocation(torDirectoryPath, torBrowserRelease.platform);

            await this.decompressTorFiles(torDirectoryPath);
        } catch (err) {
            throw err;
        } finally {
            await rm(this.operationDirectoryPath);
        }
    }

    addExecutionRigthsOnTorBinaryFile(
        torDirectoryPath: string,
        platform: NodeJS.Platform = process.platform,
    ) {
        return chmodAddX(joinPath(torDirectoryPath, this.getTorBinaryFilename(platform)));
    }
}

export { TorDownloader };
