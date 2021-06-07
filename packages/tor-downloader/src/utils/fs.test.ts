import {
    chmod as chmodFs,
    constants,
    Dirent,
    mkdir as mkdirFs,
    mkdtemp as mkdtempFs,
    readdir as readdirFs,
    rename as renameFs,
    stat as statFs,
} from "fs";
import { tmpdir } from "os";
import { join as joinPath, basename } from "path";
import * as rimraf from "rimraf";
import { chmodAddX, mkdir, mkdirTemp, readdir, rename, rm } from "./fs";

const { S_IXUSR, S_IXGRP, S_IXOTH } = constants;

jest.mock("fs");
const mockChmodFs = chmodFs as jest.MockedFunction<typeof chmodFs>;
const mockStatFs = statFs as jest.MockedFunction<typeof statFs>;
const mockMkdirFs = mkdirFs as jest.MockedFunction<typeof mkdirFs>;
const mockMkdtempFs = mkdtempFs as jest.MockedFunction<typeof mkdtempFs>;
const mockReaddirFs = readdirFs as jest.MockedFunction<typeof readdirFs>;
const mockRenameFs = renameFs as jest.MockedFunction<typeof renameFs>;

jest.mock("os");
const mockTmpdir = tmpdir as jest.MockedFunction<typeof tmpdir>;

jest.mock("rimraf");
const mockRimraf = rimraf as jest.MockedFunction<typeof rimraf>;

describe("fs", () => {
    beforeEach(() => {
        mockChmodFs.mockClear();
        mockStatFs.mockClear();
        mockMkdirFs.mockClear();
        mockMkdtempFs.mockClear();
        mockReaddirFs.mockClear();
        mockRenameFs.mockClear();
        mockTmpdir.mockClear();
        mockRimraf.mockClear();
    });

    describe("chmodAddX", () => {
        it("should add execution permission to a file", async () => {
            const test = async (_fileMode: number) => {
                mockChmodFs.mockClear();
                mockStatFs.mockClear();

                const filePath = "/foo";
                mockStatFs.mockImplementation((_path, cb: any) => cb(null, { mode: _fileMode }));
                mockChmodFs.mockImplementation((_path, _mode, cb) => cb(null));

                await chmodAddX(filePath);

                expect(mockStatFs).toBeCalledTimes(1);
                expect(mockStatFs).toBeCalledWith(filePath, expect.any(Function));

                expect(mockChmodFs).toBeCalledTimes(1);
                expect(mockChmodFs).toBeCalledWith(
                    filePath,
                    _fileMode | S_IXUSR | S_IXGRP | S_IXOTH,
                    expect.any(Function),
                );
            };

            await test(0o644);
            await test(0o755);
        });

        it("should throw errors", async () => {
            const error = new Error("MockError");
            mockStatFs.mockImplementation((_path, cb: any) => cb(error));

            const call = () => chmodAddX("/foo");

            await expect(call).rejects.toThrow(error);
            expect(mockStatFs).toBeCalledTimes(1);

            mockStatFs.mockImplementation((_path, cb: any) => cb(null, { mode: 0o644 }));
            mockChmodFs.mockImplementation((_path, _mode, cb) => cb(error));

            await expect(call).rejects.toThrow(error);
            expect(mockStatFs).toBeCalledTimes(2);
            expect(mockChmodFs).toBeCalledTimes(1);
        });
    });

    describe("mkdir", () => {
        it("should make directory", async () => {
            const test = async (_options?: any) => {
                mockMkdirFs.mockClear();

                const path = "/foo";
                mockMkdirFs.mockImplementation(
                    jest.fn().mockImplementation((_path, _options, cb) => cb(null, path)),
                );

                const ret = await mkdir(path, _options);

                expect(ret).toEqual(path);
                expect(mockMkdirFs).toBeCalledTimes(1);
                expect(mockMkdirFs).toBeCalledWith(path, _options, expect.any(Function));
            };

            await test({ recursive: true });
            await test();
        });

        it("should throw errors", async () => {
            const error = new Error("MockError");
            mockMkdirFs.mockImplementation(
                jest.fn().mockImplementation((_path, _options, cb) => cb(error)),
            );

            const call = () => mkdir("/foo");

            await expect(call).rejects.toThrow(error);
            expect(mockMkdirFs).toBeCalledTimes(1);
        });
    });

    describe("mkdirTemp", () => {
        it("should make a tmp directory", async () => {
            const test = async (prefix?: string, options?: any) => {
                mockMkdtempFs.mockClear();
                mockTmpdir.mockClear();

                const tmpDir = "/tmp";
                const directory = `${tmpDir}/directory`;
                mockMkdtempFs.mockImplementation(
                    jest.fn().mockImplementation((_prefix, _options, cb) => cb(null, directory)),
                );
                mockTmpdir.mockReturnValue(tmpDir);

                const ret = await mkdirTemp(prefix, options);

                expect(ret).toEqual(directory);
                expect(mockMkdtempFs).toBeCalledTimes(1);
                expect(mockMkdtempFs).toBeCalledWith(
                    prefix || joinPath(tmpDir, `${basename(process.cwd())}-`),
                    options,
                    expect.any(Function),
                );
            };

            await test("/tmp/foo", "utf8");
            await test("/tmp/bar");
            await test();
        });

        it("should throw errors", async () => {
            const error = new Error("MockError");
            mockMkdtempFs.mockImplementation(
                jest.fn().mockImplementation((_prefix, _options, cb) => cb(error)),
            );

            const call = () => mkdirTemp("/tmp/foo");

            await expect(call).rejects.toThrow(error);
            expect(mockMkdtempFs).toBeCalledTimes(1);
        });
    });

    describe("readdir", () => {
        it("should read a directory", async () => {
            const test = async (options?: any) => {
                mockReaddirFs.mockClear();

                const path = "/foo";
                const files: string[] | Dirent[] = [];
                mockReaddirFs.mockImplementation((_path, _options, cb: any) => cb(null, files));

                const ret = await readdir(path, options);

                expect(ret).toEqual(files);
                expect(mockReaddirFs).toBeCalledTimes(1);
                expect(mockReaddirFs).toBeCalledWith(path, options, expect.any(Function));
            };

            await test("utf8");
            await test();
        });

        it("should throw errors", async () => {
            const error = new Error("MockError");
            mockReaddirFs.mockImplementation((_path, _options, cb) => cb(error, []));

            const call = () => readdir("/foo");

            await expect(call).rejects.toThrow(error);
            expect(mockReaddirFs).toBeCalledTimes(1);
        });
    });

    describe("rename", () => {
        it("should rename a path to another path", async () => {
            const oldPath = "/foo";
            const newPath = "/bar";
            mockRenameFs.mockImplementation((_oldPath, _newPath, cb: any) => cb(null));

            await rename(oldPath, newPath);

            expect(mockRenameFs).toBeCalledTimes(1);
            expect(mockRenameFs).toBeCalledWith(oldPath, newPath, expect.any(Function));
        });

        it("should throw errors", async () => {
            const error = new Error("MockError");
            mockRenameFs.mockImplementation((_oldPath, _newPath, cb) => cb(error));

            const call = () => rename("/bar", "/foo");

            await expect(call).rejects.toThrow(error);
            expect(mockRenameFs).toBeCalledTimes(1);
        });
    });

    describe("rm", () => {
        it("should rm a directory or a file", async () => {
            const test = async (options?: rimraf.Options) => {
                mockRimraf.mockClear();

                const path = "/foo";
                mockRimraf.mockImplementation(
                    jest.fn().mockImplementation((_path, _options, cb) => cb(null)),
                );

                await rm(path, options);

                expect(mockRimraf).toBeCalledTimes(1);
                expect(mockRimraf).toBeCalledWith(path, options || {}, expect.any(Function));
            };

            await test({});
            await test();
        });

        it("should throw errors", async () => {
            const error = new Error("MockError");
            mockRimraf.mockImplementation(
                jest.fn().mockImplementation((_path, _options, cb) => cb(error)),
            );

            const call = () => rm("/foo");

            await expect(call).rejects.toThrow(error);
            expect(mockRimraf).toBeCalledTimes(1);
        });
    });
});
