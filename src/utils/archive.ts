import { createReadStream, createWriteStream } from "fs";
import { async as StreamZip } from "node-stream-zip";
import { Decompressor } from "xz";

async function unzip(zipFilePath: string, toDirectoryPath: string) {
    const zip = new StreamZip({ file: zipFilePath });
    await zip.extract(null, toDirectoryPath);
    await zip.close();
}

function decompressXz(filePath: string, decompressedFilePath: string) {
    return new Promise<void>((resolve, reject) => {
        const readStream = createReadStream(filePath);
        const writeStream = createWriteStream(decompressedFilePath);
        const decompressor = new Decompressor();

        readStream.on("error", reject);
        decompressor.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("close", () => resolve());

        readStream.pipe(decompressor).pipe(writeStream);
    });
}

export { decompressXz, unzip };
