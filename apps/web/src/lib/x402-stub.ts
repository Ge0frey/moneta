/**
 * Build-time stub for the optional `@x402/*` payment packages that RainbowKit → @wagmi/connectors (Base Account)
 * → @coinbase/cdp-sdk imports. Moneta never uses x402 payments; these placeholders only satisfy the bundler and
 * throw if anything ever calls them.
 */
const unavailable = (name: string) =>
  class {
    constructor() {
      throw new Error(`${name} (x402) is not available in Moneta`);
    }
  };
const fn = (name: string) => () => {
  throw new Error(`${name} (x402) is not available in Moneta`);
};

export const x402Client = unavailable("x402Client");
export const x402ResourceServer = unavailable("x402ResourceServer");
export const x402HTTPResourceServer = unavailable("x402HTTPResourceServer");
export const HTTPFacilitatorClient = unavailable("HTTPFacilitatorClient");
export const ExactEvmScheme = unavailable("ExactEvmScheme");
export const ExactEvmSchemeV1 = unavailable("ExactEvmSchemeV1");
export const UptoEvmScheme = unavailable("UptoEvmScheme");
export const AuthCaptureEvmScheme = unavailable("AuthCaptureEvmScheme");
export const BatchSettlementEvmScheme = unavailable("BatchSettlementEvmScheme");
export const ExactSvmScheme = unavailable("ExactSvmScheme");
export const ExactSvmSchemeV1 = unavailable("ExactSvmSchemeV1");
export const UptoSvmScheme = unavailable("UptoSvmScheme");
export const BuilderCodeClientExtension = unavailable("BuilderCodeClientExtension");
export const registerExactEvmScheme = fn("registerExactEvmScheme");
export const toClientEvmSigner = fn("toClientEvmSigner");
export const wrapFetchWithPayment = fn("wrapFetchWithPayment");
export const paymentMiddlewareFromConfig = fn("paymentMiddlewareFromConfig");
export const paymentMiddlewareFromHTTPServer = fn("paymentMiddlewareFromHTTPServer");
export const bazaarResourceServerExtension = {};
export const builderCodeResourceServerExtension = {};
export const BUILDER_CODE = "";
export const BUILDER_CODE_PATTERN = /$^/;
export const BUILDER_CODE_SCHEMA = {};
export const PaymentRequirementsV1Schema = {};
export const PaymentRequirementsV2Schema = {};
export default {};
