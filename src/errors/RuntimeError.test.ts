import { RuntimeError } from "./RuntimeError";

describe("RuntimeError", () => {
    it("should return an instance of HttpError with message and http status code", () => {
        const message = "foo";

        const test = (_message?: string) => {
            const runtimeError = new RuntimeError(_message as any);
            expect(runtimeError).toBeInstanceOf(RuntimeError);
            expect(runtimeError.message).toEqual(_message || "");
        };

        test(message);
        test();
    });
});
