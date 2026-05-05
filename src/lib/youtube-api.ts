// Singleton loader for the YouTube IFrame API.
// Loading the script multiple times re-fires onYouTubeIframeAPIReady and
// triggers race conditions, so we cache the load promise globally.

type YTApi = NonNullable<Window["YT"]>;

let apiPromise: Promise<YTApi> | null = null;

export function loadYouTubeApi(): Promise<YTApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API can only load in the browser"));
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTApi>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // Chain any existing callback so we don't clobber another consumer.
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
    };

    // Inject the script tag once. Subsequent calls return the cached promise.
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}
