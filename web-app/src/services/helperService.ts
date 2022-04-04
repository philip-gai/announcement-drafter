export class HelperService {
  public static getErrorMessage(error: unknown): string {
    let errorMessage = "An unknown error has occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    return errorMessage;
  }
}
