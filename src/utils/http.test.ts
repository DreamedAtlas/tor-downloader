import { HttpError, RuntimeError } from "../errors";
import { ClientRequest, IncomingMessage, request as requestHttp } from "http";
import { request as requestHttps, RequestOptions } from "https";
import { Writable } from "stream";
import { request, requestStream } from "./http";

jest.mock("http");
const mockRequestHttp = requestHttp as jest.MockedFunction<typeof requestHttp>;

jest.mock("https");
const mockRequestHttps = requestHttps as jest.MockedFunction<typeof requestHttps>;

const getMockClientRequest = (
    error?: Error,
    mockIncomingMessage?: Partial<IncomingMessage>,
): Partial<ClientRequest> => {
    return {
        on: jest.fn().mockImplementation((event, listener) => {
            if (error && event === "error") {
                return listener(error);
            }
            if (mockIncomingMessage && event === "response") {
                return listener(mockIncomingMessage);
            }
        }),
        end: jest.fn(),
    };
};

const getMockIncomingMessage = (
    statusCode: number | null,
    error?: Error,
    mockData?: Buffer,
): Partial<IncomingMessage> => {
    return {
        statusCode,
        on: jest.fn().mockImplementation((event, listener) => {
            if (error && event === "error") {
                return listener(error);
            }
            if (mockData && event === "data") {
                return listener(mockData);
            }
            if (mockData && event === "end") {
                return listener();
            }
        }),
        pipe: jest.fn().mockImplementation((stream) => stream),
    };
};

describe("http", () => {
    beforeEach(() => {
        mockRequestHttp.mockClear();
        mockRequestHttps.mockClear();
    });

    describe("request", () => {
        it("should make http(s) requests", async () => {
            const test = async (url: string, options?: RequestOptions) => {
                mockRequestHttp.mockClear();
                mockRequestHttps.mockClear();

                const incomingMessageData = Buffer.from("data");
                const mockIncomingMessage = getMockIncomingMessage(200, null, incomingMessageData);
                const mockClientRequest = getMockClientRequest(null, mockIncomingMessage);
                mockRequestHttp.mockImplementation(
                    (_url, _options) => mockClientRequest as ClientRequest,
                );
                mockRequestHttps.mockImplementation(
                    (_url, _options) => mockClientRequest as ClientRequest,
                );

                const ret = await request(url, options);
                expect(ret).toEqual(String(incomingMessageData));

                if (url.toLowerCase().startsWith("https")) {
                    expect(mockRequestHttps).toBeCalledTimes(1);
                    expect(mockRequestHttps).toBeCalledWith(url, options);
                } else {
                    expect(mockRequestHttp).toBeCalledTimes(1);
                    expect(mockRequestHttp).toBeCalledWith(url, options);
                }

                expect(mockClientRequest.on).toBeCalledWith("response", expect.any(Function));
                expect(mockClientRequest.end).toBeCalledTimes(1);

                expect(mockIncomingMessage.on).toBeCalledWith("data", expect.any(Function));
                expect(mockIncomingMessage.on).toBeCalledWith("end", expect.any(Function));
            };

            await test("http://foo.bar");
            await test("https://foo.bar");
            await test("HTTPS://FOO.BAR");
            await test("https://foo.bar", { method: "POST" });
        });

        it("should handle redirections", async () => {
            const url = "https://foo.bar";
            const redirection = "https://bar.foo";
            const headers = {
                location: redirection,
            };

            const incomingMessageData = Buffer.from("data");
            const mockIncomingMessageSecond = getMockIncomingMessage(
                200,
                null,
                incomingMessageData,
            );
            const mockClientRequestSecond = getMockClientRequest(null, mockIncomingMessageSecond);
            mockRequestHttps.mockImplementation(
                (_url, _options) => mockClientRequestSecond as ClientRequest,
            );

            const test = async (
                statusCode: number,
                options?: RequestOptions,
                strict: boolean = false,
            ) => {
                mockRequestHttps.mockClear();

                const mockIncomingMessageFirst = getMockIncomingMessage(statusCode);
                mockIncomingMessageFirst.headers = headers;
                const mockClientRequestFirst = getMockClientRequest(null, mockIncomingMessageFirst);
                mockRequestHttps.mockImplementationOnce(
                    (_url, _options) => mockClientRequestFirst as ClientRequest,
                );

                const ret = await request(url, options);
                expect(ret).toEqual(String(incomingMessageData));

                expect(mockRequestHttps).toBeCalledTimes(2);
                expect(mockRequestHttps).toBeCalledWith(url, options);
                expect(mockRequestHttps).toBeCalledWith(
                    redirection,
                    strict ? { method: "GET" } : options || { method: "GET" },
                );
            };

            await test(301, undefined, true);
            await test(302, { method: "POST" }, true);
            await test(303, { method: "GET" }, true);
            await test(307, { method: "GET" });
            await test(307, { method: "POST" });
            await test(308);
        });

        it("should throw errors", async () => {
            const req = () => request("https://foo.bar");

            let mockIncomingMessage = getMockIncomingMessage(null);
            let mockClientRequest = getMockClientRequest(null, mockIncomingMessage);
            mockRequestHttps.mockImplementation(
                (_url, _options) => mockClientRequest as ClientRequest,
            );

            await expect(req).rejects.toThrow(RuntimeError);
            await expect(req).rejects.toThrow("missing status code");

            mockIncomingMessage = getMockIncomingMessage(0);
            mockClientRequest = getMockClientRequest(null, mockIncomingMessage);

            await expect(req).rejects.toThrow(RuntimeError);
            await expect(req).rejects.toThrow("missing status code");

            let error = new Error("test");
            mockIncomingMessage = getMockIncomingMessage(200, error);
            mockClientRequest = getMockClientRequest(null, mockIncomingMessage);

            await expect(req).rejects.toThrow(error);

            const statusMessage = "message";
            mockIncomingMessage = getMockIncomingMessage(500);
            mockIncomingMessage.statusMessage = statusMessage;
            mockClientRequest = getMockClientRequest(null, mockIncomingMessage);

            await expect(req).rejects.toThrow(HttpError);
            await expect(req).rejects.toThrow(statusMessage);

            const code = 500;
            mockIncomingMessage = getMockIncomingMessage(code);
            mockClientRequest = getMockClientRequest(null, mockIncomingMessage);

            await expect(req).rejects.toThrow(HttpError);
            await expect(req).rejects.toThrow(String(code));
        });
    });

    describe("requestStream", () => {
        it("should make http(s) requests", async () => {
            const test = async (options?: RequestOptions) => {
                mockRequestHttps.mockClear();

                const url = "https://foo.bar";

                const mockIncomingMessage = getMockIncomingMessage(200);
                const mockClientRequest = getMockClientRequest(null, mockIncomingMessage);
                mockRequestHttps.mockImplementation(
                    (_url, _options) => mockClientRequest as ClientRequest,
                );

                const mockWritable: Partial<Writable> = {
                    on: jest.fn().mockImplementation((event, listener) => {
                        if (event === "close") {
                            return listener();
                        }
                    }),
                };

                await requestStream(mockWritable as Writable, url, options);

                expect(mockRequestHttps).toBeCalledTimes(1);
                expect(mockRequestHttps).toBeCalledWith(url, options);

                expect(mockClientRequest.on).toBeCalledWith("response", expect.any(Function));
                expect(mockClientRequest.end).toBeCalledTimes(1);

                expect(mockIncomingMessage.pipe).toBeCalledTimes(1);
                expect(mockIncomingMessage.pipe).toBeCalledWith(mockWritable);
            };

            await test({ method: "POST" });
            await test();
        });

        it("should throw errors", async () => {
            const url = "https://foo.bar";

            const error = new Error("test");
            let mockClientRequest = getMockClientRequest(error);
            mockRequestHttps.mockImplementation(
                (_url, _options) => mockClientRequest as ClientRequest,
            );

            const mockWritable: Partial<Writable> = {
                on: jest.fn(),
            };

            const reqStream = () => requestStream(mockWritable as Writable, url);

            await expect(reqStream).rejects.toThrow(error);

            let mockIncomingMessage = getMockIncomingMessage(200);
            mockClientRequest = getMockClientRequest(null, mockIncomingMessage);
            mockWritable.on = jest.fn().mockImplementation((event, listener) => {
                if (event === "error") {
                    return listener(error);
                }
            });

            await expect(reqStream).rejects.toThrow(error);
        });
    });
});
