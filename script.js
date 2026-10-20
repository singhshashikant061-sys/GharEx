const getFriendlyRequestError = (message) => {
  const text = String(message || "");
  return text || "Request could not be submitted right now. Please try again shortly.";
};

const getServiceRequestUrls = () => {
  return [API_URL];
};
