import { createReadStream as createFsReadStream } from "fs";
import { requestStream } from "../utils/http";

class SignatureVerifier {
    private static KEY_FINGERPRINT = "EF6E286DDA85EA2A4BA7DE684E2C6E8793298290";
    private static OPENPGP_KEYS_ENDPOINT = "https://keys.openpgp.org/vks/v1/by-fingerprint/";

    private built: boolean;

    private _publicKeyFingerprint: string;
    private publicKeys: [];

    private keyReadArmored: Function | undefined;
    private messageFromBinary: Function | undefined;
    private openpgpVerify: Function | undefined;
    private signatureReadArmored: Function | undefined;
    private streamReadToEnd: Function | undefined;

    constructor(publicKeyFingerprint = SignatureVerifier.KEY_FINGERPRINT) {
        this.built = false;
        this._publicKeyFingerprint = publicKeyFingerprint;
    }

    async build() {
        if (!this.built) {
            try {
                // @ts-ignore (stream missing in @types)
                const { key, message, signature, stream, verify } = await import("openpgp");
                this.keyReadArmored = key.readArmored;
                this.messageFromBinary = message.fromBinary;
                this.openpgpVerify = verify;
                this.signatureReadArmored = signature.readArmored;
                this.streamReadToEnd = stream.readToEnd;

                this.publicKeys = (
                    await this.keyReadArmored(
                        await requestStream(
                            `${SignatureVerifier.OPENPGP_KEYS_ENDPOINT}${this.publicKeyFingerprint}`,
                        ),
                    )
                ).keys;
            } catch (err) {
                if (err.message.includes("openpgp")) {
                    console.warn("Missing openpgp dependecy - SignatureVerifier cannot operate");
                } else {
                    throw err;
                }
            }

            this.built = true;
        }
    }

    get publicKeyFingerprint() {
        return this._publicKeyFingerprint;
    }

    async canOperate() {
        await this.build();

        return !!this.openpgpVerify;
    }

    async verify(filePath: string): Promise<boolean> {
        if (!(await this.canOperate())) {
            return true;
        }

        const verified = await this.openpgpVerify({
            message: await this.messageFromBinary(createFsReadStream(filePath)),
            signature: await this.signatureReadArmored(createFsReadStream(`${filePath}.asc`)),
            publicKeys: this.publicKeys,
        });

        await this.streamReadToEnd(verified.data);

        return (
            await Promise.all(
                verified.signatures.map(
                    (signature: { verified: Promise<any> }) => signature.verified,
                ),
            )
        ).some((verified) => verified === true);
    }
}

export { SignatureVerifier };
