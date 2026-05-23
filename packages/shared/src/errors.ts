export class DelegateRunError extends Error {
  readonly code: string
  override readonly cause?: unknown

  constructor(code: string, message: string, cause?: unknown) {
    super(message)
    this.name = "DelegateRunError"
    this.code = code
    this.cause = cause
  }
}

export class BrokerVerificationError extends DelegateRunError {
  constructor(message: string, cause?: unknown) {
    super("BROKER_VERIFY_FAIL", message, cause)
    this.name = "BrokerVerificationError"
  }
}

export class BrokerSettlementError extends DelegateRunError {
  constructor(message: string, cause?: unknown) {
    super("BROKER_SETTLE_FAIL", message, cause)
    this.name = "BrokerSettlementError"
  }
}

export class OneShotRelayError extends DelegateRunError {
  readonly rpcCode?: number

  constructor(message: string, rpcCode?: number, cause?: unknown) {
    super("ONESHOT_RELAY_FAIL", message, cause)
    this.name = "OneShotRelayError"
    this.rpcCode = rpcCode
  }
}

export class VeniceError extends DelegateRunError {
  readonly httpStatus?: number

  constructor(message: string, httpStatus?: number, cause?: unknown) {
    super("VENICE_FAIL", message, cause)
    this.name = "VeniceError"
    this.httpStatus = httpStatus
  }
}
