import { HttpError } from "./HttpError";

describe("HttpError", () => {
    it("should return an instance of HttpError with message and http status code", () => {
        const message = "foo";
        const statusCode = 500;

        const test = (_messageOrStatusCode: string | number, _statusCode?: number) => {
            const httpError = new HttpError(_messageOrStatusCode as any, _statusCode);
            expect(httpError).toBeInstanceOf(HttpError);
            expect(httpError.message).toEqual(String(_messageOrStatusCode));
            expect(httpError.statusCode).toEqual(_statusCode || _messageOrStatusCode);
        };

        test(message, statusCode);
        test(statusCode);
    });

    it("should throw a type error if status code is missing", () => {
        const message = "bar";

        const test = (_message?: string) => {
            const httpError = () => new HttpError(_message as any);
            expect(httpError).toThrow(TypeError);
            expect(httpError).toThrow("statusCode");
        };

        test(message);
        test();
    });
});
