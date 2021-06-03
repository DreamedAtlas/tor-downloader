import { createReadStream, createWriteStream, ReadStream, WriteStream } from "fs";
import { async as StreamZip } from "node-stream-zip";
import { Decompressor } from "xz";
import { decompressXz, unzip } from "./archive";

jest.mock("node-stream-zip");
const mockStreamZip = StreamZip as jest.MockedClass<typeof StreamZip>;

jest.mock("fs");
const mockCreateReadStream = createReadStream as jest.MockedFunction<typeof createReadStream>;
const mockCreateWriteStream = createWriteStream as jest.MockedFunction<typeof createWriteStream>;

jest.mock("xz");
const mockDecompressor = Decompressor as jest.MockedClass<typeof Decompressor>;

describe("archive", () => {
    describe("unzip", () => {
        it("should unzip a zip file to a directory", async () => {
            const zipPath = "/foo.zip";
            const directoryPath = "/unzipped";

            await unzip(zipPath, directoryPath);

            expect(mockStreamZip).toBeCalledTimes(1);
            expect(mockStreamZip).toBeCalledWith({ file: zipPath });

            const mockInstanceStreamZip = mockStreamZip.mock.instances[0];
            expect(mockInstanceStreamZip.extract).toBeCalledTimes(1);
            expect(mockInstanceStreamZip.extract).toBeCalledWith(null, directoryPath);
            expect(mockInstanceStreamZip.close).toBeCalledTimes(1);
        });
    });

    describe("decompressXz", () => {
        const getMockReadStream = (error?: Error): Partial<ReadStream> => {
            return {
                on: jest.fn().mockImplementation((event, listener) => {
                    if (error && event === "error") {
                        return listener(error);
                    }
                }),
                pipe: jest.fn().mockImplementation((stream) => stream),
            };
        };
        const getMockWriteStream = (error?: Error): Partial<WriteStream> => {
            return {
                on: jest.fn().mockImplementation((event, listener) => {
                    if (error && event === "error") {
                        return listener(error);
                    }
                    if (!error && event === "close") {
                        return listener();
                    }
                }),
            };
        };
        const getMockDecompressor = (error?: Error): Partial<Decompressor> => {
            return {
                on: jest.fn().mockImplementation((event, listener) => {
                    if (error && event === "error") {
                        return listener(error);
                    }
                }),
                pipe: jest.fn().mockImplementation((stream) => stream),
            };
        };

        it("should decompress a xz file to a decompressed file", async () => {
            const filePath = "/foo.xz";
            const decompressedFilePath = "/foo";

            const mockReadStream = getMockReadStream();
            const mockWriteStream = getMockWriteStream();
            const mockDecompress = getMockDecompressor();
            mockCreateReadStream.mockReturnValue(mockReadStream as ReadStream);
            mockCreateWriteStream.mockReturnValue(mockWriteStream as WriteStream);
            mockDecompressor.mockReturnValue(mockDecompress as Decompressor);

            await decompressXz(filePath, decompressedFilePath);

            expect(mockCreateReadStream).toBeCalledTimes(1);
            expect(mockCreateReadStream).toBeCalledWith(filePath);
            expect(mockCreateWriteStream).toBeCalledTimes(1);
            expect(mockCreateWriteStream).toBeCalledWith(decompressedFilePath);
            expect(mockDecompressor).toBeCalledTimes(1);

            expect(mockWriteStream.on).toBeCalledWith("close", expect.any(Function));
            expect(mockReadStream.pipe).toBeCalledTimes(1);
            expect(mockReadStream.pipe).toBeCalledWith(mockDecompress);
            expect(mockDecompress.pipe).toBeCalledTimes(1);
            expect(mockDecompress.pipe).toBeCalledWith(mockWriteStream);
        });

        it("should throw errors", async () => {
            const filePath = "/foo.xz";
            const decompressedFilePath = "/foo";

            const error = new Error("test");
            let mockReadStream = getMockReadStream(error);
            let mockWriteStream = getMockWriteStream();
            let mockDecompress = getMockDecompressor();
            mockCreateReadStream.mockReturnValue(mockReadStream as ReadStream);
            mockCreateWriteStream.mockReturnValue(mockWriteStream as WriteStream);
            mockDecompressor.mockReturnValue(mockDecompress as Decompressor);

            const decompress = () => decompressXz(filePath, decompressedFilePath);

            await expect(decompress).rejects.toThrow(error);

            mockReadStream = getMockReadStream();
            mockDecompress = getMockDecompressor(error);
            mockCreateReadStream.mockReturnValue(mockReadStream as ReadStream);
            mockDecompressor.mockReturnValue(mockDecompress as Decompressor);

            await expect(decompress).rejects.toThrow(error);

            mockDecompress = getMockDecompressor();
            mockWriteStream = getMockWriteStream(error);
            mockDecompressor.mockReturnValue(mockDecompress as Decompressor);
            mockCreateWriteStream.mockReturnValue(mockWriteStream as WriteStream);

            await expect(decompress).rejects.toThrow(error);
        });
    });
});
