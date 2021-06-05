import { ChildProcess, spawn } from "child_process";
import { RuntimeError } from "./errors";
import { createWriteStream as createFSWriteStream, Dirent, WriteStream } from "fs";
import { basename as basenamePath, join as joinPath } from "path";
import { ReleasePlatform } from "./tor-browser/dictionary";
import { Release as TorBrowserRelease } from "./tor-browser/Release";
import { Repository as TorBrowserRepository } from "./tor-browser/Repository";
import { decompressXz, unzip } from "./utils/archive";
import { chmodAddX, mkdir, mkdirTemp, readdir, rename, rm } from "./utils/fs";
import { writeRequestStream } from "./utils/http";
import { TorDownloader } from "./TorDownloader";
import { mock, mockDeep, MockProxy } from "jest-mock-extended";
import { tmpdir } from "os";

jest.mock("./tor-browser/Repository");
const mockTBRepository = TorBrowserRepository as jest.MockedClass<typeof TorBrowserRepository>;

const mockTBReleaseFromBranch = jest.spyOn(TorBrowserRelease, "fromBranch");

jest.mock("fs");
const mockCreateFSWriteStream = createFSWriteStream as jest.MockedFunction<
    typeof createFSWriteStream
>;

jest.mock("./utils/http");
const mockWriteRequestStream = writeRequestStream as jest.MockedFunction<typeof writeRequestStream>;

jest.mock("child_process");
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

jest.mock("./utils/fs");
const mockChmodAddX = chmodAddX as jest.MockedFunction<typeof chmodAddX>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockRename = rename as jest.MockedFunction<typeof rename>;
const mockReaddir = readdir as jest.MockedFunction<typeof readdir>;
const mockRm = rm as jest.MockedFunction<typeof rm>;
const mockMkdirTemp = mkdirTemp as jest.MockedFunction<typeof mkdirTemp>;

jest.mock("./utils/archive");
const mockDecompressXz = decompressXz as jest.MockedFunction<typeof decompressXz>;
const mockUnzip = unzip as jest.MockedFunction<typeof unzip>;

describe("Tor Downloader", () => {
    beforeEach(() => {
        mockTBRepository.mockClear();
        mockCreateFSWriteStream.mockClear();
        mockWriteRequestStream.mockClear();
        mockSpawn.mockClear();
        mockChmodAddX.mockClear();
        mockMkdir.mockClear();
        mockRename.mockClear();
        mockReaddir.mockClear();
        mockRm.mockClear();
        mockDecompressXz.mockClear();
        mockMkdirTemp.mockClear();
        mockUnzip.mockClear();
    });

    it("should return a new instance", () => {
        const test = (repository?: TorBrowserRepository) => {
            const torDownloader = new TorDownloader(repository);
            expect(torDownloader).toBeInstanceOf(TorDownloader);
            expect(mockTBRepository).toBeCalledTimes(repository ? 0 : 1);
        };

        test(mock<TorBrowserRepository>());
        test();
    });

    it("should fetch tor browser & mar tools", async () => {
        const mockTorBrowserRepository = mockDeep<TorBrowserRepository>();
        const releaseUrl = "https://foo.bar/release";
        mockTorBrowserRepository.getReleaseUrl.mockReturnValue(releaseUrl);
        mockTorBrowserRepository.getMarToolsUrl.mockReturnValue(releaseUrl);
        const mockWriteStream = mock<WriteStream>();
        mockCreateFSWriteStream.mockReturnValue(mockWriteStream);
        const mockTBRelease = mock<TorBrowserRelease>();

        const operationDirectoryPath = joinPath(tmpdir(), "foo");
        const expectedFilePath = joinPath(operationDirectoryPath, basenamePath(releaseUrl));

        const torDownloader = new TorDownloader(mockTorBrowserRepository);

        // @ts-ignore
        torDownloader.operationDirectoryPath = operationDirectoryPath;
        // @ts-ignore
        const filePath = await torDownloader.fetchTorBrowser(mockTBRelease);
        // @ts-ignore
        const marPath = await torDownloader.fetchMarTools(mockTBRelease);

        expect(filePath).toEqual(expectedFilePath);
        expect(marPath).toEqual(expectedFilePath);

        expect(mockTorBrowserRepository.getReleaseUrl).toBeCalledTimes(1);
        expect(mockTorBrowserRepository.getReleaseUrl).toBeCalledWith(mockTBRelease);

        expect(mockTorBrowserRepository.getMarToolsUrl).toBeCalledTimes(1);
        expect(mockTorBrowserRepository.getMarToolsUrl).toBeCalledWith(mockTBRelease);

        expect(mockCreateFSWriteStream).toBeCalledTimes(2);
        expect(mockCreateFSWriteStream).toBeCalledWith(expectedFilePath);

        expect(mockWriteRequestStream).toBeCalledTimes(2);
        expect(mockWriteRequestStream).toBeCalledWith(mockWriteStream, releaseUrl);
    });

    it("should get the path to the mar binary", () => {
        const originalPlatform = process.platform;

        // @ts-ignore
        const marBinaryFilePath = TorDownloader.MAR_BINARY_FILE_PATH;

        const torDownloader = new TorDownloader();
        const operationDirectoryPath = joinPath(tmpdir(), "foo");

        // @ts-ignore
        torDownloader.operationDirectoryPath = operationDirectoryPath;

        const test = (platform: NodeJS.Platform) => {
            Object.defineProperty(process, "platform", { value: platform });

            const expectedPath = joinPath(
                operationDirectoryPath,
                `${marBinaryFilePath}${platform === "win32" ? ".exe" : ""}`,
            );

            // @ts-ignore
            const path = torDownloader.getMarBinaryPath();

            expect(path).toEqual(expectedPath);
        };

        test("darwin");
        test("linux");
        test("win32");

        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should get the tor binary filename", () => {
        // @ts-ignore
        const torBinaryFilename = TorDownloader.TOR_BINARY_FILENAME;

        const torDownloader = new TorDownloader();

        const test = (platform?: NodeJS.Platform | ReleasePlatform, isWin?: boolean) => {
            const expectedFilename = `${torBinaryFilename}${
                isWin || process.platform === "win32" ? ".exe" : ""
            }`;

            const filename = torDownloader.getTorBinaryFilename(platform);

            expect(filename).toEqual(expectedFilename);
        };

        test("darwin", false);
        test("osx", false);
        test("linux", false);
        test("win32", true);
        test("win", true);
        test();
    });

    describe("execMarUnpack", () => {
        const getMockChildProcess = (error?: Error, code: number = 0): Partial<ChildProcess> => {
            return {
                on: jest.fn().mockImplementation((event, listener) => {
                    if (error && event === "error") {
                        return listener(error);
                    }
                    if (!error && event === "close") {
                        return listener(code);
                    }
                }),
            };
        };

        let torDownloader: TorDownloader;
        const marBinaryPath = "/mar";

        beforeEach(() => {
            torDownloader = new TorDownloader();

            // @ts-ignore
            const mockGetMarBinaryPath = jest.spyOn<TorDownloader, () => string>(
                torDownloader,
                "getMarBinaryPath",
            );
            mockGetMarBinaryPath.mockReturnValue(marBinaryPath);
        });

        it("should exec mar unpack", async () => {
            const code = 0;
            const mockChildProcess = getMockChildProcess(null, code);
            mockSpawn.mockReturnValue(mockChildProcess as ChildProcess);

            const toPath = "/foo";
            const torBrowserFilePath = "/bar";
            // @ts-ignore
            torDownloader.torBrowserFilePath = torBrowserFilePath;

            const operationDirectoryPath = "/operation";
            // @ts-ignore
            torDownloader.operationDirectoryPath = operationDirectoryPath;

            // @ts-ignore
            const retCode = await torDownloader.execMarUnpack(toPath);

            expect(retCode).toEqual(code);
            expect(mockSpawn).toBeCalledTimes(1);
            expect(mockSpawn).toBeCalledWith(
                marBinaryPath,
                ["-C", toPath, "-x", torBrowserFilePath],
                { cwd: operationDirectoryPath },
            );
        });

        it("should throw error", async () => {
            const error = new Error("test");
            const code = 1;
            const mockChildProcess = getMockChildProcess(error, code);
            mockSpawn.mockReturnValue(mockChildProcess as ChildProcess);

            // @ts-ignore
            const execMarUnpack = () => torDownloader.execMarUnpack("/foo");

            await expect(execMarUnpack).rejects.toThrow(error);
        });
    });

    describe("unpackTorBrowser", () => {
        let torDownloader: TorDownloader;
        const marBinaryPath = "/mar";
        const operationDirectoryPath = "/operation";

        beforeEach(() => {
            torDownloader = new TorDownloader();

            // @ts-ignore
            const mockGetMarBinaryPath = jest.spyOn<TorDownloader, () => string>(
                torDownloader,
                "getMarBinaryPath",
            );
            mockGetMarBinaryPath.mockReturnValue(marBinaryPath);

            // @ts-ignore
            torDownloader.operationDirectoryPath = operationDirectoryPath;
        });

        it("should unpack tor browser", async () => {
            // @ts-ignore
            const staticUnpackedTorBrowserPath = TorDownloader.UNPACKED_TOR_BROWSER_PATH;

            // @ts-ignore
            const mockExecMarUnpack = jest.spyOn<TorDownloader>(torDownloader, "execMarUnpack");
            mockExecMarUnpack.mockReturnThis();

            const expectedUnpackedTorBrowserPath = joinPath(
                operationDirectoryPath,
                staticUnpackedTorBrowserPath,
            );

            // @ts-ignore
            const unpackedTorBrowserPath = await torDownloader.unpackTorBrowser();

            expect(unpackedTorBrowserPath).toEqual(expectedUnpackedTorBrowserPath);

            expect(mockChmodAddX).toBeCalledTimes(1);
            expect(mockChmodAddX).toBeCalledWith(marBinaryPath);

            expect(mockMkdir).toBeCalledTimes(1);
            expect(mockMkdir).toBeCalledWith(unpackedTorBrowserPath);

            expect(mockExecMarUnpack).toBeCalledTimes(1);
            expect(mockExecMarUnpack).toBeCalledWith(unpackedTorBrowserPath);

            mockMkdir.mockRejectedValueOnce(new Error("EEXIST"));
            // @ts-ignore
            await torDownloader.unpackTorBrowser();
        });

        it("should throw error", async () => {
            const error = new Error("test");
            mockMkdir.mockRejectedValueOnce(error);

            // @ts-ignore
            const unpackTorBrowser = () => torDownloader.unpackTorBrowser();

            await expect(unpackTorBrowser).rejects.toThrow(error);
        });
    });

    describe("moveTorFilesToLocation", () => {
        let torDownloader: TorDownloader;
        const operationDirectoryPath = "/operation";

        beforeEach(() => {
            torDownloader = new TorDownloader();

            // @ts-ignore
            torDownloader.operationDirectoryPath = operationDirectoryPath;
        });

        it("should move tor files to location", async () => {
            const test = async (
                platform: NodeJS.Platform | ReleasePlatform,
                renameCount: number,
            ) => {
                mockRename.mockClear();

                // @ts-ignore
                await torDownloader.moveTorFilesToLocation("/foo", platform);

                expect(mockRename).toBeCalledTimes(renameCount);
            };

            await test("darwin", 5);
            await test("osx", 5);
            await test("linux", 4);
            await test("win32", 4);
            await test("win", 4);
        });

        it("should throw error", async () => {
            const moveTorFilesToLocation = () =>
                // @ts-ignore
                torDownloader.moveTorFilesToLocation("/foo", "foo");

            await expect(moveTorFilesToLocation).rejects.toThrow(RuntimeError);
            await expect(moveTorFilesToLocation).rejects.toThrow("Unsupported platform");
        });
    });

    it("should decompress tor files", async () => {
        const filesFirst: Partial<Dirent>[] = [
            {
                name: "foo",
                isDirectory: () => true,
                isFile: () => false,
            },
        ];
        const filesSecond: Partial<Dirent>[] = [
            {
                name: "foo",
                isDirectory: () => false,
                isFile: () => true,
            },
            {
                name: "bar",
                isDirectory: () => false,
                isFile: () => false,
            },
        ];
        mockReaddir.mockResolvedValueOnce(filesFirst as Dirent[]);
        mockReaddir.mockResolvedValue(filesSecond as Dirent[]);

        const torDirectoryPath = "/foo";

        const torDownloader = new TorDownloader();
        //@ts-ignore
        await torDownloader.decompressTorFiles(torDirectoryPath);

        expect(mockReaddir).toBeCalledTimes(2);
        expect(mockReaddir).toBeCalledWith(torDirectoryPath, expect.any(Object));
        expect(mockReaddir).toBeCalledWith(
            joinPath(torDirectoryPath, filesFirst[0].name),
            expect.any(Object),
        );

        const filePath = joinPath(torDirectoryPath, filesFirst[0].name, filesSecond[0].name);
        expect(mockDecompressXz).toBeCalledTimes(1);
        expect(mockDecompressXz).toBeCalledWith(filePath, expect.any(String));
        expect(mockRm).toBeCalledTimes(1);
        expect(mockRm).toBeCalledWith(filePath);
        expect(mockRename).toBeCalledTimes(1);
        expect(mockRename).toBeCalledWith(expect.any(String), filePath);
    });

    it("should add execution rights to tor binary file", async () => {
        const torDownloader = new TorDownloader();

        await torDownloader.addExecutionRigthsOnTorBinaryFile("/foo");

        expect(mockChmodAddX).toBeCalledTimes(1);
    });

    describe("retrieve", () => {
        let torDownloader: TorDownloader;
        const operationDirectoryPath = joinPath(tmpdir(), "foo");

        beforeEach(() => {
            torDownloader = new TorDownloader();
            mockMkdirTemp.mockResolvedValue(operationDirectoryPath);
        });

        it("should retrieve tor", async () => {
            const torDirectoryPath = "/foo";

            // @ts-ignore
            const mockFetchTorBrowser = jest.spyOn<TorDownloader, () => Promise<string>>(
                torDownloader,
                "fetchTorBrowser",
            );
            mockFetchTorBrowser.mockReturnValue(Promise.resolve("/foo"));

            // @ts-ignore
            const mockFetchMarTools = jest.spyOn<TorDownloader, () => Promise<string>>(
                torDownloader,
                "fetchMarTools",
            );
            const marToolsFilePath = "/bar";
            mockFetchMarTools.mockReturnValue(Promise.resolve(marToolsFilePath));

            // @ts-ignore
            const mockUnpackTorBrowser = jest.spyOn<TorDownloader>(
                torDownloader,
                "unpackTorBrowser",
            );
            mockUnpackTorBrowser.mockReturnThis();

            // @ts-ignore
            const mockMoveTorFilesToLocation = jest.spyOn<TorDownloader>(
                torDownloader,
                "moveTorFilesToLocation",
            );
            mockMoveTorFilesToLocation.mockReturnThis();

            // @ts-ignore
            const mockDecompressTorFiles = jest.spyOn<TorDownloader>(
                torDownloader,
                "decompressTorFiles",
            );
            mockDecompressTorFiles.mockReturnThis();

            const test = async (mockTBRelease?: MockProxy<TorBrowserRelease>) => {
                mockFetchTorBrowser.mockClear();
                mockFetchMarTools.mockClear();
                mockUnpackTorBrowser.mockClear();
                mockMoveTorFilesToLocation.mockClear();
                mockDecompressTorFiles.mockClear();
                mockTBReleaseFromBranch.mockClear();
                mockMkdirTemp.mockClear();
                mockMkdir.mockClear();
                mockUnzip.mockClear();
                mockRm.mockClear();

                let mockRelease = mockTBRelease;
                if (!mockRelease) {
                    mockRelease = mockDeep<TorBrowserRelease>();
                    mockTBReleaseFromBranch.mockResolvedValue(mockRelease);
                }

                const mockMarToolsRelease = mock<TorBrowserRelease>();
                mockRelease.getMarToolsRelease.mockReturnValue(mockMarToolsRelease);

                await torDownloader.retrieve(torDirectoryPath, mockTBRelease);

                expect(mockTBReleaseFromBranch).toBeCalledTimes(mockTBRelease ? 0 : 1);

                expect(mockMkdirTemp).toBeCalledTimes(1);

                expect(mockMkdir).toBeCalledTimes(1);
                expect(mockMkdir).toBeCalledWith(torDirectoryPath, expect.any(Object));

                expect(mockFetchTorBrowser).toBeCalledTimes(1);
                expect(mockFetchTorBrowser).toBeCalledWith(mockRelease);

                expect(mockFetchMarTools).toBeCalledTimes(1);
                expect(mockFetchMarTools).toBeCalledWith(mockMarToolsRelease);

                expect(mockUnzip).toBeCalledTimes(1);
                expect(mockUnzip).toBeCalledWith(marToolsFilePath, operationDirectoryPath);

                expect(mockUnpackTorBrowser).toBeCalledTimes(1);

                expect(mockMoveTorFilesToLocation).toBeCalledTimes(1);
                expect(mockMoveTorFilesToLocation).toBeCalledWith(
                    torDirectoryPath,
                    mockRelease.platform,
                );

                expect(mockDecompressTorFiles).toBeCalledTimes(1);
                expect(mockDecompressTorFiles).toBeCalledWith(torDirectoryPath);

                expect(mockRm).toBeCalledTimes(1);
                expect(mockRm).toBeCalledWith(operationDirectoryPath);

                mockMkdir.mockRejectedValue(new Error("EEXIST"));
                await torDownloader.retrieve(torDirectoryPath, mockTBRelease);
            };

            const mockTBRelease = mockDeep<TorBrowserRelease>();
            await test(mockTBRelease);
            await test();
        });

        it("should throw error", async () => {
            const mockTBRelease = mock<TorBrowserRelease>();

            const error = new Error("test");
            mockMkdir.mockRejectedValue(error);

            const retrieve = () => torDownloader.retrieve("/foo", mockTBRelease);

            await expect(retrieve).rejects.toThrow(error);

            expect(mockRm).toBeCalledTimes(1);
            expect(mockRm).toBeCalledWith(operationDirectoryPath);
        });
    });
});
