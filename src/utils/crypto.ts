import { createReadStream } from "fs";
import { createHash } from "crypto";

async function sha256Sum(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        const sum = createHash("sha256");
        const fileStream = createReadStream(filePath);
        fileStream.on("error", reject);
        fileStream.on("data", (chunk) => {
            try {
                return sum.update(chunk);
            } catch (err) {
                reject(err);
                return fileStream.close();
            }
        });
        fileStream.on("end", () => resolve(sum.digest("hex")));
    });
}

export { sha256Sum };
