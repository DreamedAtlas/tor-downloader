import { async as StreamZip } from "node-stream-zip";

async function unzip(zipFilePath: string, toDirectoryPath: string) {
    const zip = new StreamZip({ file: zipFilePath });
    await zip.extract(null, toDirectoryPath);
    await zip.close();
}

export { unzip };
