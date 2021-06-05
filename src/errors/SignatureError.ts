import { RuntimeError } from "./RuntimeError";

class SignatureError extends RuntimeError {
    filename?: string;

    constructor(message: string, filename?: string) {
        super(message);

        this.filename = filename;
    }
}

export { SignatureError };
