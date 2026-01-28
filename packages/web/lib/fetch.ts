import { errorResponse } from "@/lib/validations/response";
import { toast } from "components/ui/use-toast";

function genericErrorToast(errorMessage?: string) {
  return toast({
    title: "Something went wrong.",
    description: errorMessage,
    variant: "destructive",
  });
}

// utility to automatically error handle fetch requests
// ONLY for use within web clients (dependent on toast)
export async function clientFetch<ResponseType = unknown>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  settings: {
    beforeRequestStart?: () => void; // called before the request is initiated
    onFail?: (error?: Error) => void; // called when the request fails, either due to a not OK or fetch throwing
    afterRequestFinish?: () => void; // called when the request is finished, regardless of success
    onRequestSuccess?: (response: ResponseType) => void; // called when the request successfully completes, with the contents of the request
    defaultErrorMessage?: string;
  }
): Promise<ResponseType | undefined> {
  const {
    beforeRequestStart,
    onFail,
    afterRequestFinish,
    onRequestSuccess,
    defaultErrorMessage,
  } = settings;

  const handleFailure = (error: any, errorMessage?: string) => {
    console.error(error);
    onFail?.(error);
    genericErrorToast(errorMessage);
  };

  beforeRequestStart?.();
  let response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    handleFailure(error);
    return;
  }
  afterRequestFinish?.();

  let responseJson;
  try {
    responseJson = await response.json();
  } catch (error) {
    // if OK, assume response is empty (but could be text or other format; choosing to not handle this)
    if (response.ok) {
      onRequestSuccess?.(responseJson); // TODO: responseJson is undefined, type this strongly since unhandled in callers
      return;
    }
    handleFailure(error, defaultErrorMessage);
    return;
  }

  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = errorResponse.parse(responseJson);
      errorMessage = errorData.error;
    } catch (error) {
      handleFailure(error, defaultErrorMessage);
      return;
    }

    toast({
      title: "Request failed.",
      description: errorMessage,
      variant: "destructive",
    });
    onFail?.();
    return;
  }

  onRequestSuccess?.(responseJson);
}
