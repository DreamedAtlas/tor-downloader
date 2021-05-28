class HttpError extends Error {
    public statusCode: number;

    constructor(statusCode: number);
    constructor(message: string, statusCode: number);
    constructor(messOrStatusCode: string | number, code?: number) {
        let statusCode = code;
        if (typeof messOrStatusCode == "number") {
            statusCode = messOrStatusCode;
        }
        if (!statusCode) {
            throw new TypeError("statusCode is mandatory");
        }

        super(String(messOrStatusCode));

        this.statusCode = statusCode;
    }
}

export { HttpError };
