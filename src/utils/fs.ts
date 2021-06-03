import {
    BaseEncodingOptions,
    chmod as chmodFs,
    constants,
    Dirent,
    MakeDirectoryOptions,
    mkdir as mkdirFs,
    mkdtemp as mkdtempFs,
    Mode,
    readdir as readdirFs,
    rename as renameFs,
    stat as statFs,
    Stats,
} from "fs";
import { tmpdir } from "os";
import { join as joinPath, basename } from "path";
import * as rimraf from "rimraf";

const { S_IXUSR, S_IXGRP, S_IXOTH } = constants;

function chmod(path: string, mode: Mode) {
    return new Promise<void>((resolve, reject) => {
        chmodFs(path, mode, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

async function chmodAddX(path: string) {
    const { mode } = await stat(path);
    return await chmod(path, mode | S_IXUSR | S_IXGRP | S_IXOTH);
}

function mkdir(path: string, options?: MakeDirectoryOptions) {
    return new Promise<string>((resolve, reject) => {
        mkdirFs(path, options, (err, path) => {
            if (err) {
                return reject(err);
            }
            return resolve(path);
        });
    });
}

function mkdirTemp(prefix?: string, options?: BaseEncodingOptions | BufferEncoding) {
    if (!prefix) {
        prefix = joinPath(tmpdir(), `${basename(process.cwd())}-`);
    }
    return mkdtemp(prefix, options);
}

function mkdtemp(prefix: string, options?: BaseEncodingOptions | BufferEncoding) {
    return new Promise<string>((resolve, reject) => {
        mkdtempFs(prefix, options, (err, folder) => {
            if (err) {
                return reject(err);
            }
            return resolve(folder);
        });
    });
}

function readdir(
    path: string,
    options?: (BaseEncodingOptions & { withFileTypes?: false }) | BufferEncoding,
): Promise<string[]>;
function readdir(
    path: string,
    options?: (BaseEncodingOptions & { withFileTypes: true }) | BufferEncoding,
): Promise<Dirent[]>;
function readdir(
    path: string,
    options?: (BaseEncodingOptions & { withFileTypes?: boolean }) | BufferEncoding,
) {
    return new Promise<string[] | Dirent[]>((resolve, reject) => {
        readdirFs(path, options as any, (err, files) => {
            if (err) {
                return reject(err);
            }
            return resolve(files);
        });
    });
}

function rename(oldPath: string, newPath: string) {
    return new Promise<void>((resolve, reject) => {
        renameFs(oldPath, newPath, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

function rm(path: string, options?: rimraf.Options) {
    return new Promise<void>((resolve, reject) => {
        rimraf(path, options || {}, (err) => {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
}

function stat(path: string) {
    return new Promise<Stats>((resolve, reject) => {
        statFs(path, (err, stats) => {
            if (err) {
                return reject(err);
            }
            return resolve(stats);
        });
    });
}

export { chmodAddX, mkdir, mkdirTemp, readdir, rename, rm };
