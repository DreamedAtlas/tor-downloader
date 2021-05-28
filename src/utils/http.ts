import { HttpError, RuntimeError } from "../errors";
import { ClientRequest, IncomingMessage, request as requestHttp } from "http";
import { request as requestHttps, RequestOptions } from "https";
import { Writable } from "stream";

const getInternalRequestPromise = (returnBody: boolean, url: string, options?: RequestOptions) => {
    return new Promise<string | IncomingMessage>((resolve, reject) => {
        const internalRequest = (_url: typeof url, _options?: typeof options) => {
            let req: ClientRequest;
            if (_url.startsWith("https")) {
                req = requestHttps(_url, _options);
            } else {
                req = requestHttp(_url, _options);
            }

            req.on("error", reject);

            req.on("response", (res) => {
                if (!res.statusCode) {
                    return reject(
                        new RuntimeError("Unknown error: missing status code on response"),
                    );
                }

                // Follow redirects
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    let requestOptions = _options;
                    if (!requestOptions) {
                        requestOptions = { method: "GET" };
                    }

                    if ([301, 302, 303].includes(res.statusCode)) {
                        // Update method to GET - RFC 7231
                        requestOptions.method = "GET";
                    }

                    return internalRequest(res.headers.location, requestOptions);
                }

                if (res.statusCode === 0 || Math.floor(res.statusCode / 100) !== 2) {
                    const message = res.statusMessage || String(res.statusCode);
                    return reject(new HttpError(message, res.statusCode));
                }

                if (returnBody) {
                    let body = "";
                    res.on("error", reject);
                    res.on("data", (chunk) => (body += String(chunk)));
                    res.on("end", () => resolve(body));
                } else {
                    return resolve(res);
                }
            });

            req.end();
        };

        internalRequest(url, options);
    });
};

function request(url: string, options?: RequestOptions) {
    return getInternalRequestPromise(true, url, options) as Promise<string>;
}

function requestStream(writable: Writable, url: string, options?: RequestOptions) {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const readable = (await getInternalRequestPromise(
                false,
                url,
                options,
            )) as IncomingMessage;
            writable.on("error", reject);
            writable.on("close", () => resolve());
            readable.pipe(writable);
        } catch (err) {
            return reject(err);
        }
    });
}

export { request, requestStream };
