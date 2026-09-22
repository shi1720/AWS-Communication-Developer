export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "This record changed. Please try again.") {
    super(409, message, "CONFLICT");
  }
}
